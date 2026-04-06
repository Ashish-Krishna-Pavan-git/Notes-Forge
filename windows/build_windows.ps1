$ErrorActionPreference = "Stop"

function Assert-LastExitCode {
  param([string]$StepName)
  if ($LASTEXITCODE -ne 0) {
    throw "$StepName failed with exit code $LASTEXITCODE."
  }
}

$Root = Split-Path -Parent $PSScriptRoot
$AppRoot = Join-Path $Root "webapp"
$Frontend = Join-Path $AppRoot "frontend"
$Backend = Join-Path $AppRoot "backend"
$MusicSource = Join-Path $Root "windows\\music"
$MusicTarget = Join-Path $Frontend "dist\\music"
$SpecFile = Join-Path $Root "windows\\NotesForge.spec"
$InstallerSpecFile = Join-Path $Root "windows\\NotesForgeInstaller.spec"
$PortableDist = Join-Path $Root "windows\\dist\\NotesForge"
$InstallerExe = Join-Path $Root "windows\\dist\\NotesForge-Setup.exe"
$PayloadZip = Join-Path $Root "windows\\build\\notesforge-windows-app.zip"
$VendorDir = Join-Path $Root "windows\\vendor"
$WebViewRuntime = Join-Path $VendorDir "MicrosoftEdgeWebView2Setup.exe"
$WebViewRuntimeUrl = "https://go.microsoft.com/fwlink/?linkid=2124701"

$env:NOTESFORGE_REPO_ROOT = $Root
$env:PYTHONUTF8 = "1"

Push-Location $Frontend
try {
  if ($env:SKIP_FRONTEND_BUILD -ne "1") {
    & npm run build
    Assert-LastExitCode "Frontend build"
  }
} finally {
  Pop-Location
}

& python (Join-Path $Backend "scripts\\validate_platform_music.py") windows
Assert-LastExitCode "Windows music validation"

if (Test-Path $MusicTarget) {
  Remove-Item -LiteralPath $MusicTarget -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $MusicTarget | Out-Null
Copy-Item -Path (Join-Path $MusicSource "*") -Destination $MusicTarget -Recurse -Force

& python -m pip install -r (Join-Path $Backend "requirements.txt")
Assert-LastExitCode "Backend dependency install"
& python -m pip install -r (Join-Path $Root "windows\\requirements-desktop.txt")
Assert-LastExitCode "Desktop dependency install"

& python -m PyInstaller `
  --noconfirm `
  --clean `
  --distpath (Join-Path $Root "windows\\dist") `
  --workpath (Join-Path $Root "windows\\build") `
  $SpecFile
Assert-LastExitCode "Portable Windows bundle build"

if (!(Test-Path (Join-Path $PortableDist "NotesForge.exe"))) {
  throw "Portable Windows bundle was not created."
}

New-Item -ItemType Directory -Force -Path (Split-Path $PayloadZip -Parent) | Out-Null
if (Test-Path $PayloadZip) {
  Remove-Item -LiteralPath $PayloadZip -Force
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(
  $PortableDist,
  $PayloadZip,
  [System.IO.Compression.CompressionLevel]::Optimal,
  $false
)

New-Item -ItemType Directory -Force -Path $VendorDir | Out-Null
if (!(Test-Path $WebViewRuntime)) {
  try {
    Invoke-WebRequest -Uri $WebViewRuntimeUrl -OutFile $WebViewRuntime
  } catch {
    Write-Warning "WebView2 offline runtime package could not be downloaded. Installer will still be built."
  }
}

$env:NOTESFORGE_INSTALLER_PAYLOAD = $PayloadZip
if (Test-Path $WebViewRuntime) {
  $env:NOTESFORGE_WEBVIEW2_BOOTSTRAPPER = $WebViewRuntime
} else {
  Remove-Item Env:\NOTESFORGE_WEBVIEW2_BOOTSTRAPPER -ErrorAction SilentlyContinue
}

& python -m PyInstaller `
  --noconfirm `
  --clean `
  --distpath (Join-Path $Root "windows\\dist") `
  --workpath (Join-Path $Root "windows\\build\\installer") `
  $InstallerSpecFile
Assert-LastExitCode "Windows installer build"

if (!(Test-Path $InstallerExe)) {
  throw "Windows installer executable was not created."
}

Write-Host ""
Write-Host "Windows build complete."
Write-Host "Portable app:"
Write-Host "  windows/dist/NotesForge/NotesForge.exe"
Write-Host "Installer:"
Write-Host "  windows/dist/NotesForge-Setup.exe"
