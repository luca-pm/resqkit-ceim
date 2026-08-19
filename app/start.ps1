# Local dev launcher for ResQKit. No network calls, no external platform -
# just starts the backend (FastAPI/uvicorn) and frontend (Vite) against the
# .env files in app/backend and app/frontend. Requires PostgreSQL already
# running locally (see app/backend/.env for the connection string).

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$logDir = Join-Path $root ".run-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Import-DotEnv($path) {
    if (-not (Test-Path $path)) { return }
    Get-Content $path | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $key, $value = $line.Split("=", 2)
            [System.Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim(), "Process")
        }
    }
}

function Wait-ForPort($portUrl, $seconds) {
    for ($i = 0; $i -lt $seconds; $i++) {
        try {
            Invoke-WebRequest -Uri $portUrl -UseBasicParsing -TimeoutSec 2 | Out-Null
            return $true
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    return $false
}

# Refresh PATH from the machine/user env in case node/npm were installed
# after this shell was opened.
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

Write-Host "Starting ResQKit backend..."
Import-DotEnv (Join-Path $backendDir ".env")
$backendProc = Start-Process -FilePath (Join-Path $backendDir ".venv\Scripts\python.exe") `
    -ArgumentList "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8001" `
    -WorkingDirectory $backendDir -NoNewWindow -PassThru `
    -RedirectStandardOutput (Join-Path $logDir "backend.out.log") `
    -RedirectStandardError (Join-Path $logDir "backend.err.log")

$npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
if (-not $npmCmd) { $npmCmd = (Get-Command npm -ErrorAction SilentlyContinue) }
if (-not $npmCmd) {
    Write-Error "npm was not found on PATH. Install Node.js, or open a new terminal so PATH picks it up, then re-run this script."
    exit 1
}

Write-Host "Starting ResQKit frontend..."
$frontendProc = Start-Process -FilePath $npmCmd.Source -ArgumentList "run", "dev", "--", "--host", "127.0.0.1", "--port", "5174" `
    -WorkingDirectory $frontendDir -NoNewWindow -PassThru `
    -RedirectStandardOutput (Join-Path $logDir "frontend.out.log") `
    -RedirectStandardError (Join-Path $logDir "frontend.err.log")

Write-Host "Waiting for backend on http://127.0.0.1:8001/health ..."
$backendUp = Wait-ForPort "http://127.0.0.1:8001/health" 20
Write-Host "Waiting for frontend on http://127.0.0.1:5174/ ..."
$frontendUp = Wait-ForPort "http://127.0.0.1:5174/" 30

Write-Host ""
if ($backendUp) { Write-Host "Backend:  http://127.0.0.1:8001  (OK)" } else { Write-Host "Backend:  FAILED to come up - see $logDir\backend.err.log" }
if ($frontendUp) { Write-Host "Frontend: http://127.0.0.1:5174  (OK)  <-- open this one in your browser" } else { Write-Host "Frontend: FAILED to come up - see $logDir\frontend.err.log" }
Write-Host ""
Write-Host "Logs: $logDir"
Write-Host "Backend PID: $($backendProc.Id)   Frontend PID: $($frontendProc.Id)"
