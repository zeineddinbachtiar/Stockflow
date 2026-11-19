param(
  [Parameter(Mandatory = $true)]
  [string]$RequestPipeName,
  [Parameter(Mandatory = $true)]
  [string]$ResponsePipeName,
  [Parameter(Mandatory = $true)]
  [string]$ProbeExecutable
)

$ErrorActionPreference = "Stop"
$job = [IntPtr]::Zero
$requestPipe = $null
$responsePipe = $null
$reader = $null
$writer = $null
$exitCode = 1
$running = @{}
$shutdownRequested = $false
$shutdownDeadline = [DateTime]::MaxValue

function Send-Message {
  param([object]$Message)

  $json = ConvertTo-Json -InputObject $Message -Compress -Depth 20
  $script:writer.WriteLine($json)
}

function Get-EnvironmentBlock {
  param([object]$Environment)

  $values = [System.Collections.Generic.Dictionary[string,string]]::new(
    [StringComparer]::OrdinalIgnoreCase
  )
  foreach ($entry in Get-ChildItem Env:) {
    $values[[string]$entry.Name] = [string]$entry.Value
  }
  foreach ($property in $Environment.PSObject.Properties) {
    $values[[string]$property.Name] = [string]$property.Value
  }

  $entries = @(
    $values.Keys |
      Sort-Object |
      ForEach-Object { "$_=$($values[$_])" }
  )
  return ([string]::Join([string][char]0, [string[]]$entries) + [char]0 + [char]0)
}

function Get-CommandLine {
  param(
    [string]$Command,
    [object[]]$Arguments
  )

  $parts = @([StockFlow.JobHost.Native]::QuoteArgument($Command))
  foreach ($argument in $Arguments) {
    $parts += [StockFlow.JobHost.Native]::QuoteArgument([string]$argument)
  }
  return [string]::Join(" ", $parts)
}

try {
  $null = Add-Type -Path (Join-Path $PSScriptRoot "windows-job-native.cs")
  $requestPipe = [System.IO.Pipes.NamedPipeClientStream]::new(
    ".",
    $RequestPipeName,
    [System.IO.Pipes.PipeDirection]::In,
    [System.IO.Pipes.PipeOptions]::None
  )
  $responsePipe = [System.IO.Pipes.NamedPipeClientStream]::new(
    ".",
    $ResponsePipeName,
    [System.IO.Pipes.PipeDirection]::Out,
    [System.IO.Pipes.PipeOptions]::None
  )
  $requestPipe.Connect(10000)
  $responsePipe.Connect(10000)
  [StockFlow.JobHost.Native]::PreventHandleInheritance(
    $requestPipe.SafePipeHandle.DangerousGetHandle()
  )
  [StockFlow.JobHost.Native]::PreventHandleInheritance(
    $responsePipe.SafePipeHandle.DangerousGetHandle()
  )
  $encoding = [System.Text.UTF8Encoding]::new($false)
  $reader = [System.IO.StreamReader]::new(
    $requestPipe,
    $encoding,
    $false,
    4096,
    $true
  )
  $writer = [System.IO.StreamWriter]::new(
    $responsePipe,
    $encoding,
    4096,
    $true
  )
  $writer.AutoFlush = $true

  $job = [StockFlow.JobHost.Native]::CreateKillOnCloseJob()

  $probeCommand = $ProbeExecutable
  $probeLine = Get-CommandLine -Command $probeCommand -Arguments @("-e", "process.exit(0)")
  $probeEnvironment = Get-EnvironmentBlock -Environment ([PSCustomObject]@{})
  $probe = [StockFlow.JobHost.Native]::StartSuspendedInJob(
    $job,
    $probeCommand,
    $probeLine,
    $env:SystemRoot,
    $probeEnvironment
  )
  [StockFlow.JobHost.Native]::ResumeProcess($probe)
  $probeDeadline = [DateTime]::UtcNow.AddSeconds(15)
  $probeExitCode = $null
  while ($null -eq $probeExitCode -and [DateTime]::UtcNow -lt $probeDeadline) {
    $probeExitCode = [StockFlow.JobHost.Native]::GetExitCodeIfExited($probe.Handle)
    if ($null -eq $probeExitCode) {
      Start-Sleep -Milliseconds 20
    }
  }
  if ($null -eq $probeExitCode) {
    throw "Job Object assignment preflight timed out."
  }
  [StockFlow.JobHost.Native]::CloseThread($probe.ThreadHandle)
  [StockFlow.JobHost.Native]::CloseProcess($probe.Handle)
  if ($probeExitCode -ne 0) {
    throw "Job Object assignment preflight exited with code $probeExitCode."
  }
  if ([StockFlow.JobHost.Native]::GetActiveProcessCount($job) -ne 0) {
    throw "Job Object assignment preflight left active processes."
  }
  Send-Message @{ type = "ready"; jobObject = "kill-on-close" }

  $readTask = $reader.ReadLineAsync()
  while ($true) {
    foreach ($id in @($running.Keys)) {
      $process = $running[$id]
      $processExitCode = [StockFlow.JobHost.Native]::GetExitCodeIfExited(
        $process.JobProcess.Handle
      )
      if ($null -ne $processExitCode) {
        Send-Message @{
          type = "exit"
          id = $id
          code = $processExitCode
          processId = $process.ProcessId
        }
        [StockFlow.JobHost.Native]::CloseProcess($process.JobProcess.Handle)
        [StockFlow.JobHost.Native]::CloseThread($process.JobProcess.ThreadHandle)
        $running.Remove($id)
      }
    }

    if ($shutdownRequested) {
      $activeCount = [StockFlow.JobHost.Native]::GetActiveProcessCount($job)
      if ($activeCount -eq 0) {
        [StockFlow.JobHost.Native]::CloseJob($job)
        $job = [IntPtr]::Zero
        Send-Message @{
          type = "shutdown-complete"
          activeProcessCount = 0
        }
        $exitCode = 0
        break
      }
      if ([DateTime]::UtcNow -ge $shutdownDeadline) {
        [StockFlow.JobHost.Native]::CloseJob($job)
        $job = [IntPtr]::Zero
        Send-Message @{
          type = "shutdown-failed"
          activeProcessCount = $activeCount
          message = "Job Object still had active processes at the shutdown deadline."
        }
        break
      }
    }

    if ($readTask.IsCompleted) {
      $line = $readTask.GetAwaiter().GetResult()
      if ($null -eq $line) {
        if ($job -ne [IntPtr]::Zero) {
          [StockFlow.JobHost.Native]::CloseJob($job)
          $job = [IntPtr]::Zero
        }
        break
      }

      $request = ConvertFrom-Json -InputObject $line
      switch ([string]$request.type) {
        "prepare" {
          try {
            if ($shutdownRequested) {
              throw "Cannot start a process during shutdown."
            }
            $command = [string]$request.command
            $process = [StockFlow.JobHost.Native]::StartSuspendedInJob(
              $job,
              $command,
              (Get-CommandLine -Command $command -Arguments @($request.arguments)),
              [string]$request.cwd,
              (Get-EnvironmentBlock -Environment $request.environment)
            )
            $running[[string]$request.id] = @{
              JobProcess = $process
              ProcessId = $process.ProcessId
              Resumed = $false
            }
            Send-Message @{
              type = "prepared"
              id = [string]$request.id
              processId = $process.ProcessId
              processCreationTime = $process.CreationTime
            }
          }
          catch {
            Send-Message @{
              type = "prepare-failed"
              id = [string]$request.id
              message = $_.Exception.Message
            }
          }
        }
        "resume" {
          $process = $running[[string]$request.id]
          if (-not $process -or $process.Resumed) {
            throw "Cannot resume an unknown or already resumed process."
          }
          [StockFlow.JobHost.Native]::ResumeProcess($process.JobProcess)
          $process.Resumed = $true
          Send-Message @{
            type = "resumed"
            requestId = [string]$request.requestId
            id = [string]$request.id
          }
        }
        "snapshot" {
          $processes = @(
            [StockFlow.JobHost.Native]::GetJobProcessIdentities($job) |
              ForEach-Object {
                @{
                  processId = $_.ProcessId
                  creationTime = $_.CreationTime
                }
              }
          )
          Send-Message @{
            type = "snapshot"
            id = [string]$request.id
            processes = $processes
          }
        }
        "shutdown" {
          if (-not $shutdownRequested) {
            $shutdownRequested = $true
            $shutdownDeadline = [DateTime]::UtcNow.AddMilliseconds(
              [Math]::Max(0, [int]$request.timeoutMs)
            )
            [StockFlow.JobHost.Native]::TerminateJob($job, 1)
          }
        }
        default {
          throw "Unknown job-host command '$($request.type)'."
        }
      }

      $readTask = $reader.ReadLineAsync()
    }
    else {
      Start-Sleep -Milliseconds 10
    }
  }
}
catch {
  if ($writer) {
    try {
      Send-Message @{
        type = "fatal"
        message = $_.Exception.Message
      }
    }
    catch {
      [Console]::Error.WriteLine($_.Exception.Message)
    }
  }
  else {
    [Console]::Error.WriteLine($_.Exception.Message)
  }
  $exitCode = 1
}
finally {
  if ($job -ne [IntPtr]::Zero) {
    try {
      [StockFlow.JobHost.Native]::CloseJob($job)
    }
    catch {
      [Console]::Error.WriteLine($_.Exception.Message)
      $exitCode = 1
    }
  }
  foreach ($process in $running.Values) {
    [StockFlow.JobHost.Native]::CloseProcess($process.JobProcess.Handle)
    [StockFlow.JobHost.Native]::CloseThread($process.JobProcess.ThreadHandle)
  }
  if ($reader) { $reader.Dispose() }
  if ($writer) { $writer.Dispose() }
  if ($requestPipe) { $requestPipe.Dispose() }
  if ($responsePipe) { $responsePipe.Dispose() }
}

exit $exitCode
