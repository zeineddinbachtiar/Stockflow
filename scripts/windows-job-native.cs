using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

namespace StockFlow.JobHost
{
    public sealed class JobProcess
    {
        public IntPtr Handle { get; set; }
        public IntPtr ThreadHandle { get; set; }
        public int ProcessId { get; set; }
        public string CreationTime { get; set; }
    }

    public sealed class JobProcessIdentity
    {
        public long ProcessId { get; set; }
        public string CreationTime { get; set; }
    }

    public static class Native
    {
        private const uint CreateSuspended = 0x00000004;
        private const uint CreateUnicodeEnvironment = 0x00000400;
        private const uint StartfUseStdHandles = 0x00000100;
        private const uint JobObjectExtendedLimitInformation = 9;
        private const uint JobObjectBasicAccountingInformation = 1;
        private const uint JobObjectBasicProcessIdList = 3;
        private const uint KillOnJobClose = 0x00002000;
        private const uint WaitObject0 = 0;
        private const uint WaitTimeout = 258;
        private const uint HandleFlagInherit = 1;
        private const uint ProcessQueryLimitedInformation = 0x1000;

        [StructLayout(LayoutKind.Sequential)]
        private struct BasicLimitInformation
        {
            public long PerProcessUserTimeLimit;
            public long PerJobUserTimeLimit;
            public uint LimitFlags;
            public UIntPtr MinimumWorkingSetSize;
            public UIntPtr MaximumWorkingSetSize;
            public uint ActiveProcessLimit;
            public UIntPtr Affinity;
            public uint PriorityClass;
            public uint SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct IoCounters
        {
            public ulong ReadOperationCount;
            public ulong WriteOperationCount;
            public ulong OtherOperationCount;
            public ulong ReadTransferCount;
            public ulong WriteTransferCount;
            public ulong OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct ExtendedLimitInformation
        {
            public BasicLimitInformation BasicLimitInformation;
            public IoCounters IoInfo;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryUsed;
            public UIntPtr PeakJobMemoryUsed;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct BasicAccountingInformation
        {
            public long TotalUserTime;
            public long TotalKernelTime;
            public long ThisPeriodTotalUserTime;
            public long ThisPeriodTotalKernelTime;
            public uint TotalPageFaults;
            public uint TotalProcesses;
            public uint ActiveProcesses;
            public uint TotalTerminatedProcesses;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct StartupInfo
        {
            public uint Size;
            public IntPtr Reserved;
            public IntPtr Desktop;
            public IntPtr Title;
            public uint X;
            public uint Y;
            public uint XSize;
            public uint YSize;
            public uint XCountChars;
            public uint YCountChars;
            public uint FillAttribute;
            public uint Flags;
            public ushort ShowWindow;
            public ushort Reserved2;
            public IntPtr Reserved2Pointer;
            public IntPtr StandardInput;
            public IntPtr StandardOutput;
            public IntPtr StandardError;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct ProcessInformation
        {
            public IntPtr Process;
            public IntPtr Thread;
            public uint ProcessId;
            public uint ThreadId;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct NativeFileTime
        {
            public uint Low;
            public uint High;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern IntPtr CreateJobObjectW(IntPtr attributes, string name);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool SetInformationJobObject(
            IntPtr job,
            uint informationClass,
            IntPtr information,
            uint informationLength
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool QueryInformationJobObject(
            IntPtr job,
            uint informationClass,
            IntPtr information,
            uint informationLength,
            out uint returnLength
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool TerminateJobObject(IntPtr job, uint exitCode);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool CloseHandle(IntPtr handle);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool SetHandleInformation(
            IntPtr handle,
            uint mask,
            uint flags
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern uint ResumeThread(IntPtr thread);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool TerminateProcess(IntPtr process, uint exitCode);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr OpenProcess(
            uint desiredAccess,
            bool inheritHandle,
            uint processId
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool IsProcessInJob(
            IntPtr process,
            IntPtr job,
            out bool result
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool GetProcessTimes(
            IntPtr process,
            out NativeFileTime creationTime,
            out NativeFileTime exitTime,
            out NativeFileTime kernelTime,
            out NativeFileTime userTime
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr GetStdHandle(int standardHandle);

        [DllImport(
            "kernel32.dll",
            CharSet = CharSet.Unicode,
            SetLastError = true
        )]
        private static extern bool CreateProcessW(
            string applicationName,
            StringBuilder commandLine,
            IntPtr processAttributes,
            IntPtr threadAttributes,
            bool inheritHandles,
            uint creationFlags,
            IntPtr environment,
            string currentDirectory,
            ref StartupInfo startupInfo,
            out ProcessInformation processInformation
        );

        public static IntPtr CreateKillOnCloseJob()
        {
            IntPtr job = CreateJobObjectW(IntPtr.Zero, null);
            if (job == IntPtr.Zero)
            {
                throw LastError("CreateJobObjectW failed");
            }

            var limits = new ExtendedLimitInformation();
            limits.BasicLimitInformation.LimitFlags = KillOnJobClose;
            IntPtr buffer = Marshal.AllocHGlobal(
                Marshal.SizeOf(typeof(ExtendedLimitInformation))
            );
            try
            {
                Marshal.StructureToPtr(limits, buffer, false);
                if (
                    !SetInformationJobObject(
                        job,
                        JobObjectExtendedLimitInformation,
                        buffer,
                        (uint)Marshal.SizeOf(typeof(ExtendedLimitInformation))
                    )
                )
                {
                    throw LastError("Could not enable JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE");
                }
            }
            catch
            {
                CloseHandle(job);
                throw;
            }
            finally
            {
                Marshal.FreeHGlobal(buffer);
            }

            return job;
        }

        public static JobProcess StartSuspendedInJob(
            IntPtr job,
            string applicationName,
            string commandLine,
            string workingDirectory,
            string environmentBlock
        )
        {
            IntPtr environment = Marshal.StringToHGlobalUni(environmentBlock);
            var startupInfo = new StartupInfo();
            startupInfo.Size = (uint)Marshal.SizeOf(typeof(StartupInfo));
            startupInfo.Flags = StartfUseStdHandles;
            startupInfo.StandardInput = GetStdHandle(-10);
            startupInfo.StandardOutput = GetStdHandle(-11);
            startupInfo.StandardError = GetStdHandle(-12);

            ProcessInformation processInformation;
            try
            {
                if (
                    !CreateProcessW(
                        applicationName,
                        new StringBuilder(commandLine),
                        IntPtr.Zero,
                        IntPtr.Zero,
                        true,
                        CreateSuspended | CreateUnicodeEnvironment,
                        environment,
                        workingDirectory,
                        ref startupInfo,
                        out processInformation
                    )
                )
                {
                    throw LastError("CreateProcessW failed");
                }
            }
            finally
            {
                Marshal.FreeHGlobal(environment);
            }

            try
            {
                if (!AssignProcessToJobObject(job, processInformation.Process))
                {
                    throw LastError("AssignProcessToJobObject failed");
                }

                string creationTime = GetProcessCreationTime(
                    processInformation.Process
                );
                return new JobProcess
                {
                    Handle = processInformation.Process,
                    ThreadHandle = processInformation.Thread,
                    ProcessId = unchecked((int)processInformation.ProcessId),
                    CreationTime = creationTime
                };
            }
            catch
            {
                TerminateProcess(processInformation.Process, 1);
                WaitForSingleObject(processInformation.Process, 5000);
                CloseHandle(processInformation.Thread);
                CloseHandle(processInformation.Process);
                throw;
            }
        }

        public static void ResumeProcess(JobProcess process)
        {
            if (
                process.ThreadHandle == IntPtr.Zero ||
                ResumeThread(process.ThreadHandle) == UInt32.MaxValue
            )
            {
                throw LastError("ResumeThread failed");
            }
            CloseHandle(process.ThreadHandle);
            process.ThreadHandle = IntPtr.Zero;
        }

        public static int? GetExitCodeIfExited(IntPtr process)
        {
            uint waitResult = WaitForSingleObject(process, 0);
            if (waitResult == WaitTimeout)
            {
                return null;
            }
            if (waitResult != WaitObject0)
            {
                throw LastError("WaitForSingleObject failed");
            }

            uint exitCode;
            if (!GetExitCodeProcess(process, out exitCode))
            {
                throw LastError("GetExitCodeProcess failed");
            }
            return unchecked((int)exitCode);
        }

        public static uint GetActiveProcessCount(IntPtr job)
        {
            IntPtr buffer = Marshal.AllocHGlobal(
                Marshal.SizeOf(typeof(BasicAccountingInformation))
            );
            try
            {
                uint returnLength;
                if (
                    !QueryInformationJobObject(
                        job,
                        JobObjectBasicAccountingInformation,
                        buffer,
                        (uint)Marshal.SizeOf(typeof(BasicAccountingInformation)),
                        out returnLength
                    )
                )
                {
                    throw LastError("Could not query active Job Object processes");
                }

                return Marshal.PtrToStructure<BasicAccountingInformation>(buffer)
                    .ActiveProcesses;
            }
            finally
            {
                Marshal.FreeHGlobal(buffer);
            }
        }

        public static long[] GetJobProcessIds(IntPtr job)
        {
            int capacity = 64;
            while (capacity <= 1048576)
            {
                int size = 8 + capacity * IntPtr.Size;
                IntPtr buffer = Marshal.AllocHGlobal(size);
                try
                {
                    uint returnLength;
                    bool success = QueryInformationJobObject(
                        job,
                        JobObjectBasicProcessIdList,
                        buffer,
                        (uint)size,
                        out returnLength
                    );
                    uint assigned = unchecked((uint)Marshal.ReadInt32(buffer, 0));
                    uint listed = unchecked((uint)Marshal.ReadInt32(buffer, 4));
                    if (success && listed >= assigned)
                    {
                        var processIds = new long[(int)listed];
                        for (int index = 0; index < listed; index++)
                        {
                            processIds[index] = Marshal
                                .ReadIntPtr(buffer, 8 + index * IntPtr.Size)
                                .ToInt64();
                        }
                        return processIds;
                    }

                    int error = Marshal.GetLastWin32Error();
                    if (!success && error != 234 && error != 122)
                    {
                        throw new Win32Exception(
                            error,
                            "Could not query Job Object process IDs"
                        );
                    }
                    capacity = Math.Max(capacity * 2, checked((int)assigned + 16));
                }
                finally
                {
                    Marshal.FreeHGlobal(buffer);
                }
            }

            throw new InvalidOperationException("Job Object process list is too large.");
        }

        public static JobProcessIdentity[] GetJobProcessIdentities(IntPtr job)
        {
            var identities = new System.Collections.Generic.List<JobProcessIdentity>();
            foreach (long processId in GetJobProcessIds(job))
            {
                IntPtr process = OpenProcess(
                    ProcessQueryLimitedInformation,
                    false,
                    checked((uint)processId)
                );
                if (process == IntPtr.Zero)
                {
                    if (Array.IndexOf(GetJobProcessIds(job), processId) >= 0)
                    {
                        throw LastError(
                            "Could not verify an active Job Object process identity"
                        );
                    }
                    continue;
                }

                try
                {
                    bool isMember;
                    if (!IsProcessInJob(process, job, out isMember))
                    {
                        throw LastError("Could not verify Job Object membership");
                    }
                    if (!isMember)
                    {
                        continue;
                    }

                    identities.Add(
                        new JobProcessIdentity
                        {
                            ProcessId = processId,
                            CreationTime = GetProcessCreationTime(process)
                        }
                    );
                }
                finally
                {
                    CloseHandle(process);
                }
            }

            return identities.ToArray();
        }

        public static void TerminateJob(IntPtr job, uint exitCode)
        {
            if (!TerminateJobObject(job, exitCode))
            {
                throw LastError("TerminateJobObject failed");
            }
        }

        public static void CloseJob(IntPtr job)
        {
            if (job != IntPtr.Zero && !CloseHandle(job))
            {
                throw LastError("Could not close Job Object");
            }
        }

        public static void CloseProcess(IntPtr process)
        {
            if (process != IntPtr.Zero)
            {
                CloseHandle(process);
            }
        }

        public static void CloseThread(IntPtr thread)
        {
            if (thread != IntPtr.Zero)
            {
                CloseHandle(thread);
            }
        }

        public static void PreventHandleInheritance(IntPtr handle)
        {
            if (!SetHandleInformation(handle, HandleFlagInherit, 0))
            {
                throw LastError("Could not protect the control-pipe handle");
            }
        }

        public static string QuoteArgument(string value)
        {
            bool needsQuotes = value.Length == 0;
            foreach (char character in value)
            {
                if (Char.IsWhiteSpace(character) || character == '"')
                {
                    needsQuotes = true;
                    break;
                }
            }
            if (!needsQuotes)
            {
                return value;
            }

            var result = new StringBuilder();
            result.Append('"');
            int backslashes = 0;
            foreach (char character in value)
            {
                if (character == '\\')
                {
                    backslashes++;
                    continue;
                }

                if (character == '"')
                {
                    result.Append('\\', backslashes * 2 + 1);
                    result.Append('"');
                    backslashes = 0;
                    continue;
                }

                result.Append('\\', backslashes);
                backslashes = 0;
                result.Append(character);
            }

            result.Append('\\', backslashes * 2);
            result.Append('"');
            return result.ToString();
        }

        private static Win32Exception LastError(string message)
        {
            return new Win32Exception(Marshal.GetLastWin32Error(), message);
        }

        private static string GetProcessCreationTime(IntPtr process)
        {
            NativeFileTime creationTime;
            NativeFileTime exitTime;
            NativeFileTime kernelTime;
            NativeFileTime userTime;
            if (
                !GetProcessTimes(
                    process,
                    out creationTime,
                    out exitTime,
                    out kernelTime,
                    out userTime
                )
            )
            {
                throw LastError("Could not read process creation time");
            }

            ulong fileTime = ((ulong)creationTime.High << 32) | creationTime.Low;
            return fileTime.ToString();
        }
    }
}
