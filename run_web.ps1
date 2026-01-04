param(
  [int]$PreferredPort = 8123,
  [int]$MaxAttempts = 200,
  [switch]$OpenFirewall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-PortFree([int]$Port) {
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
    $listener.Start()
    $listener.Stop()
    return $true
  } catch {
    return $false
  }
}

function Get-TailscaleIPv4() {
  $cmd = Get-Command tailscale -ErrorAction SilentlyContinue
  if (-not $cmd) { return $null }
  try {
    $ip = (tailscale ip -4 | Select-Object -First 1).Trim()
    if ($ip -match '^\d{1,3}(?:\.\d{1,3}){3}$') { return $ip }
    return $null
  } catch {
    return $null
  }
}

$port = $PreferredPort
$found = $false
for ($i = 0; $i -lt $MaxAttempts; $i++) {
  if (Test-PortFree $port) {
    $found = $true
    break
  }
  $port++
}

if (-not $found) {
  throw "Could not find a free port starting at $PreferredPort after $MaxAttempts attempts."
}

if ($OpenFirewall) {
  try {
    $ruleName = "Double Pendulum Web ($port)"
    $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $existing) {
      New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -Profile Private | Out-Null
    }
  } catch {
    Write-Warning "Failed to add Windows Firewall rule. Re-run PowerShell as Administrator or open TCP $port manually."
  }
}

$tsIp = Get-TailscaleIPv4

Write-Host "Serving web app on port $port" -ForegroundColor Cyan
Write-Host "Local:    http://localhost:$port/index.html"
if ($tsIp) {
  Write-Host "Tailscale: http://$tsIp:$port/index.html"
} else {
  Write-Host "Tailscale: (tailscale not detected or not running)"
}

python -m http.server $port --bind 0.0.0.0
