# Starts HTTP MCP server + ngrok for claude.ai (browser) and prints the connector URL.
# Token is read from token.txt next to this script (gitignored); generated if missing.
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User") + ";$env:ProgramFiles\nodejs"

# --- token ---
$tokenFile = Join-Path $root "token.txt"
if (Test-Path $tokenFile) {
  $token = (Get-Content $tokenFile -Raw).Trim()
} else {
  $token = -join (1..48 | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
  Set-Content -Path $tokenFile -Value $token -NoNewline
  Write-Host "Generated new token -> token.txt"
}

# --- HTTP server (also owns the 3055 bridge) ---
$env:AUTH_TOKEN = $token; $env:MCP_PORT = "3056"; $env:PORT = "3055"
Write-Host "Starting HTTP server (3055 bridge + 3056 MCP)..."
Start-Process node -ArgumentList "mcp-http-server.js" -WorkingDirectory (Join-Path $root "server") -WindowStyle Minimized
Start-Sleep -Seconds 3

# --- ngrok ---
$ngrok = (Get-Command ngrok -ErrorAction SilentlyContinue).Source
if (-not $ngrok) { $ngrok = "$env:LOCALAPPDATA\claude-to-figma\ngrok.exe" }
if (-not (Test-Path $ngrok)) {
  Write-Host "ngrok not found. Install ngrok or put ngrok.exe into $env:LOCALAPPDATA\claude-to-figma\" -ForegroundColor Yellow
  Read-Host "Press Enter to exit"; exit 1
}
Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "Starting ngrok..."
Start-Process $ngrok -ArgumentList "http","3056" -WindowStyle Minimized
Start-Sleep -Seconds 7

# --- connector URL ---
try {
  $api = Invoke-RestMethod -UseBasicParsing -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 10
  $pub = ($api.tunnels | Where-Object { $_.public_url -like "https*" } | Select-Object -First 1).public_url
  Write-Host ""
  Write-Host "=== URL for Connectors in claude.ai ===" -ForegroundColor Green
  Write-Host "$pub/$token/mcp"
} catch {
  Write-Host "ngrok did not return a URL - check proxy (needs transparent/TUN mode) and retry." -ForegroundColor Yellow
}
Write-Host ""
Read-Host "Done. Server and ngrok windows are minimized. Press Enter to close"
