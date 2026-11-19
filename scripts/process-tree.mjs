import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const STARTUP_TIMEOUT_MS = 15_000;
const SHUTDOWN_TIMEOUT_MS = 30_000;
const PROCESS_POLL_INTERVAL_MS = 100;
const WINDOWS_JOB_HOST = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "windows-job-host.ps1",
);

function createDeferred() {
  let resolve;
  let reject;
  let settled = false;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = (value) => {
      if (settled) return;
      settled = true;
      resolvePromise(value);
    };
    reject = (error) => {
      if (settled) return;
      settled = true;
      rejectPromise(error);
    };
  });
  return { promise, resolve, reject };
}

function waitUntil(promise, deadline, label) {
  const remaining = Math.max(0, deadline - Date.now());
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error(`${label} exceeded the shutdown deadline.`)),
        remaining,
      );
    }),
  ]).finally(() => clearTimeout(timeout));
}

function isProcessGroupRunning(pid) {
  if (!pid) return false;

  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    throw error;
  }
}

async function waitForProcessGroupToStop(state, deadline) {
  while (Date.now() < deadline) {
    if (state.closeInfo && !isProcessGroupRunning(state.child.pid)) return true;
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.min(PROCESS_POLL_INTERVAL_MS, deadline - Date.now()),
      ),
    );
  }
  return (
    state.closeInfo !== undefined && !isProcessGroupRunning(state.child.pid)
  );
}

async function stopPosixProcessGroup(state, deadline, onWarning) {
  if (state.closeInfo && !isProcessGroupRunning(state.child.pid)) return;

  try {
    process.kill(-state.child.pid, "SIGTERM");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }

  const gracefulDeadline = Math.min(deadline, Date.now() + 10_000);
  if (await waitForProcessGroupToStop(state, gracefulDeadline)) return;

  onWarning(`Forcing shutdown of ${state.name} process group.`);
  try {
    process.kill(-state.child.pid, "SIGKILL");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }

  if (!(await waitForProcessGroupToStop(state, deadline))) {
    throw new Error(`Could not confirm ${state.name} process group stopped.`);
  }
}

function makeProcessState(name, id) {
  const terminated = createDeferred();
  return {
    id,
    name,
    pid: undefined,
    creationTime: undefined,
    processError: undefined,
    exitInfo: undefined,
    prepared: false,
    resumed: false,
    terminationPromise: terminated.promise,
    resolveTermination: terminated.resolve,
  };
}

export class WindowsJobManager {
  constructor({ cwd, env = process.env }) {
    this.cwd = cwd;
    this.env = env;
    this.host = undefined;
    this.hostCloseInfo = undefined;
    this.hostError = undefined;
    this.servers = [];
    this.requestSocket = undefined;
    this.responseSocket = undefined;
    this.buffer = "";
    this.states = new Map();
    this.pendingCommands = new Map();
    this.readyDeferred = createDeferred();
    this.connectionDeferred = createDeferred();
    this.shutdownDeferred = undefined;
    this.shutdownConfirmed = false;
    this.started = false;
    this.shutdownPromise = undefined;
    this.hostCloseDeferred = createDeferred();
  }

  async start() {
    if (process.platform !== "win32") {
      throw new Error(
        "Windows Job Object containment is only available on Windows.",
      );
    }

    const basePipeName = `stockflow_e2e_${randomUUID().replaceAll("-", "")}`;
    const requestPipeName = `${basePipeName}_request`;
    const responsePipeName = `${basePipeName}_response`;
    await Promise.all([
      this.createPipeServer(requestPipeName, "request"),
      this.createPipeServer(responsePipeName, "response"),
    ]);

    this.host = spawn(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        WINDOWS_JOB_HOST,
        "-RequestPipeName",
        requestPipeName,
        "-ResponsePipeName",
        responsePipeName,
        "-ProbeExecutable",
        process.execPath,
      ],
      {
        cwd: this.cwd,
        env: this.env,
        stdio: "inherit",
        windowsHide: true,
      },
    );
    this.host.once("error", (error) => this.fail(error));
    this.host.once("close", (code, signal) => {
      this.hostCloseInfo = { code, signal };
      this.hostCloseDeferred.resolve(this.hostCloseInfo);
      if (!this.shutdownPromise) {
        this.fail(
          new Error(
            `Windows Job Object host exited unexpectedly with code ${code ?? "unknown"}.`,
          ),
        );
      }
    });

    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    await waitUntil(
      Promise.race([
        this.connectionDeferred.promise,
        this.hostCloseDeferred.promise.then((info) => {
          throw new Error(
            `Windows Job Object host exited before connecting (code ${info.code ?? "unknown"}).`,
          );
        }),
      ]),
      deadline,
      "Windows Job Object host startup",
    );
    await waitUntil(
      Promise.race([
        this.readyDeferred.promise,
        this.hostCloseDeferred.promise.then((info) => {
          throw new Error(
            `Windows Job Object preflight failed (exit ${info.code ?? "unknown"}).`,
          );
        }),
      ]),
      deadline,
      "Windows Job Object preflight",
    );

    this.started = true;
    return this;
  }

  async createPipeServer(pipeName, channel) {
    const server = net.createServer((socket) =>
      this.acceptConnection(channel, socket),
    );
    server.on("error", (error) => this.fail(error));
    this.servers.push(server);
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(`\\\\.\\pipe\\${pipeName}`, resolve);
    });
  }

  acceptConnection(channel, socket) {
    const socketProperty =
      channel === "request" ? "requestSocket" : "responseSocket";
    if (this[socketProperty]) {
      socket.destroy();
      this.fail(
        new Error(
          `Unexpected second Windows Job Object ${channel} connection.`,
        ),
      );
      return;
    }

    this[socketProperty] = socket;
    if (channel === "response") {
      socket.setEncoding("utf8");
      socket.on("data", (chunk) => this.receiveData(chunk));
    }
    socket.on("error", (error) => {
      if (!this.shutdownPromise) this.fail(error);
    });
    socket.on("close", () => {
      if (!this.shutdownPromise) {
        this.fail(
          new Error("Windows Job Object control pipe closed unexpectedly."),
        );
      }
    });
    if (this.requestSocket && this.responseSocket) {
      this.connectionDeferred.resolve();
    }
  }

  receiveData(chunk) {
    this.buffer += chunk;
    while (true) {
      const newline = this.buffer.indexOf("\n");
      if (newline < 0) return;
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;

      let message;
      try {
        message = JSON.parse(line);
      } catch (error) {
        this.fail(
          new Error(
            `Invalid Windows Job Object response: ${
              error instanceof Error ? error.message : "invalid JSON"
            }`,
          ),
        );
        return;
      }
      this.handleMessage(message);
    }
  }

  handleMessage(message) {
    if (message.type === "ready") {
      if (message.jobObject !== "kill-on-close") {
        this.readyDeferred.reject(
          new Error("Windows Job Object host did not enable kill-on-close."),
        );
        return;
      }
      this.readyDeferred.resolve();
      return;
    }

    if (message.type === "fatal") {
      this.fail(
        new Error(`Windows Job Object host failed: ${message.message}`),
      );
      return;
    }

    if (message.type === "exit") {
      const state = this.states.get(message.id);
      if (!state || state.exitInfo) return;
      state.exitInfo = { code: message.code, signal: null };
      state.resolveTermination(state.exitInfo);
      return;
    }

    if (message.type === "shutdown-complete") {
      if (message.activeProcessCount !== 0) {
        this.shutdownDeferred?.reject(
          new Error("Job Object reported active processes after shutdown."),
        );
      } else {
        this.shutdownConfirmed = true;
        this.shutdownDeferred?.resolve();
      }
      return;
    }

    if (message.type === "shutdown-failed") {
      this.shutdownDeferred?.reject(
        new Error(
          `Job Object shutdown failed with ${message.activeProcessCount} active process(es): ${message.message}`,
        ),
      );
      return;
    }

    if (message.type === "resumed") {
      const pending = this.pendingCommands.get(message.requestId);
      if (!pending) return;
      this.pendingCommands.delete(message.requestId);
      const state = this.states.get(message.id);
      if (!state) {
        pending.reject(new Error("Resumed process state was not registered."));
        return;
      }
      state.resumed = true;
      pending.resolve(state);
      return;
    }

    const pending = this.pendingCommands.get(message.id);
    if (!pending) return;
    if (message.type === "prepare-failed") {
      this.pendingCommands.delete(message.id);
      pending.reject(
        new Error(
          `${pending.name} could not be assigned to the Job Object: ${message.message}`,
        ),
      );
      return;
    }
    if (message.type === "prepared") {
      this.pendingCommands.delete(message.id);
      const state = this.states.get(message.id);
      if (
        !Number.isInteger(message.processId) ||
        !/^\d+$/.test(String(message.processCreationTime))
      ) {
        pending.reject(
          new Error("Job Object host returned an invalid process identity."),
        );
        return;
      }
      if (!state) {
        pending.reject(new Error("Prepared process state was not registered."));
        return;
      }
      state.pid = message.processId;
      state.creationTime = message.processCreationTime;
      state.prepared = true;
      pending.resolve(state);
      return;
    }
    if (message.type === "snapshot") {
      this.pendingCommands.delete(message.id);
      pending.resolve(message.processes);
    }
  }

  fail(error) {
    if (!this.hostError) this.hostError = error;
    this.readyDeferred.reject(error);
    this.connectionDeferred.reject(error);
    for (const [id, pending] of this.pendingCommands) {
      pending.reject(this.hostError);
      this.pendingCommands.delete(id);
    }
    for (const state of this.states.values()) {
      if (state.exitInfo) continue;
      state.processError = this.hostError;
      state.exitInfo = { code: null, signal: null };
      state.resolveTermination(state.exitInfo);
    }
    this.shutdownDeferred?.reject(this.hostError);
  }

  async writeMessage(message) {
    if (!this.requestSocket || this.requestSocket.destroyed) {
      throw (
        this.hostError ?? new Error("Windows Job Object pipe is unavailable.")
      );
    }
    await new Promise((resolve, reject) => {
      this.requestSocket.write(`${JSON.stringify(message)}\n`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async prepareProcess(name, command, args, env, cwd = this.cwd) {
    if (!this.started || this.shutdownPromise) {
      throw new Error("Windows Job Object manager is not accepting processes.");
    }
    if (this.hostError) throw this.hostError;

    const id = randomUUID();
    const state = makeProcessState(name, id);
    this.states.set(id, state);
    const started = createDeferred();
    started.name = name;
    this.pendingCommands.set(id, started);
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    try {
      await waitUntil(
        this.writeMessage({
          type: "prepare",
          id,
          command,
          arguments: args,
          cwd,
          environment: env,
        }),
        deadline,
        `${name} start request`,
      );
      await waitUntil(started.promise, deadline, name);
      return state;
    } catch (error) {
      this.pendingCommands.delete(id);
      this.states.delete(id);
      state.processError = error;
      state.exitInfo = { code: null, signal: null };
      state.resolveTermination(state.exitInfo);
      throw error;
    }
  }

  async resumeProcess(state) {
    if (
      !this.started ||
      this.shutdownPromise ||
      !state.prepared ||
      state.resumed ||
      state.exitInfo
    ) {
      throw new Error(`${state.name} is not in a resumable state.`);
    }
    const requestId = randomUUID();
    const response = createDeferred();
    response.name = state.name;
    this.pendingCommands.set(requestId, response);
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    try {
      await waitUntil(
        this.writeMessage({
          type: "resume",
          id: state.id,
          requestId,
        }),
        deadline,
        `${state.name} resume request`,
      );
      return await waitUntil(
        response.promise,
        deadline,
        `${state.name} resume`,
      );
    } catch (error) {
      this.pendingCommands.delete(requestId);
      throw error;
    }
  }

  async startProcess(name, command, args, env, cwd = this.cwd) {
    const state = await this.prepareProcess(name, command, args, env, cwd);
    return this.resumeProcess(state);
  }

  async snapshot() {
    if (!this.started || this.shutdownPromise) {
      throw new Error("Cannot snapshot a stopped Windows Job Object.");
    }
    const id = randomUUID();
    const response = createDeferred();
    this.pendingCommands.set(id, response);
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    await waitUntil(
      this.writeMessage({ type: "snapshot", id }),
      deadline,
      "Job Object snapshot request",
    );
    const processes = await waitUntil(
      response.promise,
      deadline,
      "Job Object snapshot",
    );
    if (
      !Array.isArray(processes) ||
      processes.some(
        (process) =>
          !Number.isInteger(process.processId) ||
          !/^\d+$/.test(String(process.creationTime)),
      )
    ) {
      throw new Error("Job Object host returned invalid process identities.");
    }
    return processes;
  }

  shutdown(deadline = Date.now() + SHUTDOWN_TIMEOUT_MS) {
    if (!this.shutdownPromise) {
      this.shutdownPromise = this.shutdownInternal(deadline);
    }
    return this.shutdownPromise;
  }

  async shutdownInternal(deadline) {
    let failure;
    try {
      if (this.host && !this.hostCloseInfo) {
        if (
          this.started &&
          this.requestSocket &&
          !this.requestSocket.destroyed
        ) {
          this.shutdownDeferred = createDeferred();
          await waitUntil(
            this.writeMessage({
              type: "shutdown",
              timeoutMs: Math.max(0, deadline - Date.now() - 1000),
            }),
            deadline,
            "Job Object shutdown request",
          );
          await waitUntil(
            this.shutdownDeferred.promise,
            deadline,
            "Job Object shutdown",
          );
        } else {
          throw (
            this.hostError ??
            new Error("Job Object host did not complete preflight.")
          );
        }

        const exit = await waitUntil(
          this.hostCloseDeferred.promise,
          deadline,
          "Job Object host exit",
        );
        if (exit.code !== 0) {
          throw new Error(
            `Windows Job Object host exited with code ${exit.code}.`,
          );
        }
      } else if (this.hostError) {
        throw this.hostError;
      }
    } catch (error) {
      failure = error;
      if (this.host && !this.hostCloseInfo) {
        this.host.kill("SIGKILL");
        try {
          await waitUntil(
            this.hostCloseDeferred.promise,
            deadline,
            "Forced Job Object host termination",
          );
        } catch (forcedError) {
          failure = new Error(
            `${error instanceof Error ? error.message : "Shutdown failed."}; ${
              forcedError instanceof Error
                ? forcedError.message
                : "Host stop unconfirmed."
            }`,
          );
        }
      }
    } finally {
      for (const socket of [this.requestSocket, this.responseSocket]) {
        if (socket && !socket.destroyed) socket.destroy();
      }
      for (const server of this.servers) {
        if (!server.listening) continue;
        try {
          await waitUntil(
            new Promise((resolve) => server.close(resolve)),
            deadline,
            "Job Object control pipe shutdown",
          );
        } catch (closeError) {
          failure ??= closeError;
        }
      }
    }

    if (failure) throw failure;
  }
}

export function trackChildProcess(name, child, onError = () => {}) {
  let resolveClose;
  let resolveTermination;
  const state = {
    name,
    child,
    processError: undefined,
    exitInfo: undefined,
    closeInfo: undefined,
    closePromise: new Promise((resolve) => {
      resolveClose = resolve;
    }),
    terminationPromise: new Promise((resolve) => {
      resolveTermination = resolve;
    }),
  };

  child.once("error", (error) => {
    state.processError = error;
    onError(`${name} process failed: ${error.message}`);
  });
  child.once("exit", (code, signal) => {
    state.exitInfo = { code, signal };
    resolveTermination(state.exitInfo);
  });
  child.once("close", (code, signal) => {
    state.closeInfo = { code, signal };
    resolveClose(state.closeInfo);
    if (!state.exitInfo) resolveTermination(state.closeInfo);
  });

  return state;
}

export async function stopProcessTree(
  state,
  {
    deadline = Date.now() + SHUTDOWN_TIMEOUT_MS,
    onWarning = (message) => console.warn(`[E2E] ${message}`),
  } = {},
) {
  if (process.platform === "win32") {
    throw new Error(
      "Windows processes must be stopped through their Job Object.",
    );
  }
  if (
    !state.child.pid ||
    (state.closeInfo && !isProcessGroupRunning(state.child.pid))
  ) {
    return;
  }
  await stopPosixProcessGroup(state, deadline, onWarning);
}
