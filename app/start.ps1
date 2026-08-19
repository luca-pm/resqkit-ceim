# Local dev launcher for ResQKit. No network calls, no external platform -
# just starts the backend (FastAPI/uvicorn) and frontend (Vite) against the
# .env files in app/backend and app/frontend. Requires PostgreSQL already
# running locally (see app/backend/.env for the connection string).
#
# -Lan: binds both servers to 0.0.0.0 instead of 127.0.0.1, so a phone or
# tablet on the same Wi-Fi can reach them (needed for the RN app's camera/
# metronome spikes and for the ISU dashboard demo on a second device). This
# is an explicit opt-in switch, off by default: it widens the backend's
# network exposure from "this machine only" to "anyone on this Wi-Fi", which
# is worth knowing before you flip it on somewhere less trusted than home.
# See ResQKit_User_Manual_LAN_mode.md for the phone/tablet setup steps.

param(
    [switch]$Lan
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$logDir = Join-Path $root ".run-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$bindHost = if ($Lan) { "0.0.0.0" } else { "127.0.0.1" }
$displayHost = "127.0.0.1"

if ($Lan) {
    $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notmatch '^169\.254\.' -and $_.IPAddress -ne '127.0.0.1' -and $_.InterfaceAlias -notmatch 'Loopback' }
    $preferred = $candidates | Where-Object { $_.InterfaceAlias -match 'Wi-?Fi|Ethernet' } | Select-Object -First 1
    if (-not $preferred) { $preferred = $candidates | Select-Object -First 1 }
    if ($preferred) {
        $displayHost = $preferred.IPAddress
        Write-Host "LAN mode: binding 0.0.0.0. Detected LAN IP: $displayHost ($($preferred.InterfaceAlias))"
        if ($candidates.Count -gt 1) {
            Write-Host "  (other candidate IPs also present: $(($candidates | Where-Object { $_.IPAddress -ne $displayHost } | ForEach-Object { $_.IPAddress }) -join ', ') - use the right one for your network if this guess is wrong)"
        }
    } else {
        Write-Host "LAN mode: binding 0.0.0.0, but no LAN IPv4 address was detected to display. Check 'ipconfig' for the right address."
    }
    Write-Host "LAN mode is ON: the backend and frontend are reachable by any device on this Wi-Fi network, not just this machine."
}

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
if ($Lan) {
    # Override whatever FRONTEND_URL is in .env so CORS accepts the LAN origin
    # the dashboard will actually be loaded from during this session.
    [System.Environment]::SetEnvironmentVariable("FRONTEND_URL", "http://${displayHost}:5174", "Process")
}
$backendProc = Start-Process -FilePath (Join-Path $backendDir ".venv\Scripts\python.exe") `
    -ArgumentList "-m", "uvicorn", "main:app", "--host", $bindHost, "--port", "8001" `
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
$frontendProc = Start-Process -FilePath $npmCmd.Source -ArgumentList "run", "dev", "--", "--host", $bindHost, "--port", "5174" `
    -WorkingDirectory $frontendDir -NoNewWindow -PassThru `
    -RedirectStandardOutput (Join-Path $logDir "frontend.out.log") `
    -RedirectStandardError (Join-Path $logDir "frontend.err.log")

Write-Host "Waiting for backend on http://127.0.0.1:8001/health ..."
$backendUp = Wait-ForPort "http://127.0.0.1:8001/health" 20
Write-Host "Waiting for frontend on http://127.0.0.1:5174/ ..."
$frontendUp = Wait-ForPort "http://127.0.0.1:5174/" 30

Write-Host ""
if ($backendUp) { Write-Host "Backend:  http://${displayHost}:8001  (OK)" } else { Write-Host "Backend:  FAILED to come up - see $logDir\backend.err.log" }
if ($frontendUp) { Write-Host "Frontend: http://${displayHost}:5174  (OK)  <-- open this one in your browser" } else { Write-Host "Frontend: FAILED to come up - see $logDir\frontend.err.log" }
if ($Lan) {
    Write-Host "Mobile app .env should point EXPO_PUBLIC_API_BASE_URL at: http://${displayHost}:8001"
}
Write-Host ""
Write-Host "Logs: $logDir"
Write-Host "Backend PID: $($backendProc.Id)   Frontend PID: $($frontendProc.Id)"
