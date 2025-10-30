# Download External Tools for Git Analyzer (Windows)
# Run this PowerShell script to download SCC and Trivy

$ErrorActionPreference = "Stop"

$ToolsDir = Join-Path $PSScriptRoot "tools"
Write-Host "Installing tools to: $ToolsDir" -ForegroundColor Cyan
Write-Host ""

# Create tools directory if it doesn't exist
if (!(Test-Path $ToolsDir)) {
    New-Item -ItemType Directory -Path $ToolsDir | Out-Null
}

# Download SCC
Write-Host "=== Downloading SCC (Source Code Counter) ===" -ForegroundColor Yellow
$SccVersion = "3.3.5"
$SccUrl = "https://github.com/boyter/scc/releases/download/v$SccVersion/scc-$SccVersion-x86_64-pc-windows.zip"
$SccZip = Join-Path $env:TEMP "scc.zip"
$SccExe = Join-Path $ToolsDir "scc.exe"

try {
    Write-Host "Downloading SCC $SccVersion for Windows..."
    Invoke-WebRequest -Uri $SccUrl -OutFile $SccZip -UseBasicParsing
    
    Write-Host "Extracting SCC..."
    Expand-Archive -Path $SccZip -DestinationPath $env:TEMP -Force
    Move-Item -Path (Join-Path $env:TEMP "scc.exe") -Destination $SccExe -Force
    
    Remove-Item $SccZip -Force
    Write-Host "✅ SCC installed to $SccExe" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to download SCC: $_" -ForegroundColor Red
    Write-Host "Please download manually from: https://github.com/boyter/scc/releases" -ForegroundColor Yellow
}
Write-Host ""

# Download Trivy
Write-Host "=== Downloading Trivy (Vulnerability Scanner) ===" -ForegroundColor Yellow
$TrivyVersion = "0.56.2"
$TrivyUrl = "https://github.com/aquasecurity/trivy/releases/download/v$TrivyVersion/trivy_${TrivyVersion}_windows-64bit.zip"
$TrivyZip = Join-Path $env:TEMP "trivy.zip"
$TrivyExe = Join-Path $ToolsDir "trivy.exe"
$TrivyCacheDir = Join-Path $ToolsDir "trivy-cache"

try {
    Write-Host "Downloading Trivy $TrivyVersion for Windows..."
    Invoke-WebRequest -Uri $TrivyUrl -OutFile $TrivyZip -UseBasicParsing
    
    Write-Host "Extracting Trivy..."
    Expand-Archive -Path $TrivyZip -DestinationPath $env:TEMP -Force
    Move-Item -Path (Join-Path $env:TEMP "trivy.exe") -Destination $TrivyExe -Force
    
    Remove-Item $TrivyZip -Force
    Write-Host "✅ Trivy installed to $TrivyExe" -ForegroundColor Green
    
    # Download Trivy vulnerability database
    Write-Host "Downloading Trivy vulnerability database (this may take a few minutes)..." -ForegroundColor Yellow
    if (!(Test-Path $TrivyCacheDir)) {
        New-Item -ItemType Directory -Path $TrivyCacheDir | Out-Null
    }
    
    $env:TRIVY_CACHE_DIR = $TrivyCacheDir
    & $TrivyExe image --download-db-only --cache-dir $TrivyCacheDir
    Write-Host "✅ Trivy database cached to $TrivyCacheDir" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to download Trivy: $_" -ForegroundColor Red
    Write-Host "Please download manually from: https://github.com/aquasecurity/trivy/releases" -ForegroundColor Yellow
}
Write-Host ""

# Install Lizard (Python package)
Write-Host "=== Installing Lizard (Code Complexity Analyzer) ===" -ForegroundColor Yellow
try {
    if (Get-Command python -ErrorAction SilentlyContinue) {
        python -m pip install lizard --upgrade
        Write-Host "✅ Lizard installed via pip" -ForegroundColor Green
    }
    elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
        python3 -m pip install lizard --upgrade
        Write-Host "✅ Lizard installed via pip" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Python not found - Lizard will be bundled in the executable" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "⚠️  Lizard installation failed (will be bundled in executable)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Tool Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verify installations
$SccExists = Test-Path $SccExe
$TrivyExists = Test-Path $TrivyExe

Write-Host "Installation Status:" -ForegroundColor Cyan
Write-Host "  SCC:    $(if ($SccExists) { '✅ Installed' } else { '❌ Missing' })"
Write-Host "  Trivy:  $(if ($TrivyExists) { '✅ Installed' } else { '❌ Missing' })"
Write-Host "  Lizard: ✅ Python package (will be bundled)"
Write-Host ""

if ($SccExists -and $TrivyExists) {
    Write-Host "✅ All tools ready!" -ForegroundColor Green
}
else {
    Write-Host "⚠️  Some tools are missing. See tools/README.txt for manual download instructions." -ForegroundColor Yellow
}
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  - Test:  python standalone_analyzer.py --repo C:\path\to\repo"
Write-Host "  - Build: build_windows.bat"
Write-Host ""

