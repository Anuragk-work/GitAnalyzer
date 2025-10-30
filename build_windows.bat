@echo off
REM ============================================================================
REM Standalone Git Analyzer - Windows Build Script
REM ============================================================================
REM This script builds a self-contained Windows executable for the Git Analyzer
REM
REM Prerequisites:
REM   - Python 3.9+ installed and in PATH
REM   - pip installed
REM   - Internet connection (for downloading external tools)
REM
REM Usage:
REM   build_windows.bat
REM ============================================================================

echo ============================================================================
echo Standalone Git Analyzer - Build Script
echo ============================================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.9 or later from python.org
    exit /b 1
)

echo [1/6] Python found
python --version

REM Install dependencies
echo.
echo [2/6] Installing dependencies...
pip install -r requirements_standalone.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    exit /b 1
)

REM Create tools directory
echo.
echo [3/6] Creating tools directory...
if not exist "tools" mkdir tools

REM Download external tools
echo.
echo [4/6] Downloading external tools...
echo.

REM Note: You need to manually download these tools and place them in the tools/ directory
REM We can't automate downloads due to GitHub's download links requiring browser interaction
echo Please download the following tools manually:
echo.
echo 1. SCC (Code Counter):
echo    URL: https://github.com/boyter/scc/releases
echo    Download: scc-X.XX.X-x86_64-pc-windows.zip
echo    Extract scc.exe to: tools\scc.exe
echo.
echo 2. Trivy (Vulnerability Scanner):
echo    URL: https://github.com/aquasecurity/trivy/releases
echo    Download: trivy_X.XX.X_windows-64bit.zip
echo    Extract trivy.exe to: tools\trivy.exe
echo.
echo 3. (Optional) CodeMaat (Evolution Analysis):
echo    URL: https://github.com/adamtornhill/code-maat/releases
echo    Download: code-maat-X.X.X-standalone.jar
echo    Copy to: tools\cm.jar
echo    Note: Requires Java Runtime Environment
echo.

REM Check if tools exist
set TOOLS_READY=1
if not exist "tools\scc.exe" (
    echo WARNING: tools\scc.exe not found
    set TOOLS_READY=0
)
if not exist "tools\trivy.exe" (
    echo WARNING: tools\trivy.exe not found
    set TOOLS_READY=0
)

if %TOOLS_READY%==0 (
    echo.
    echo WARNING: Some external tools are missing
    echo The build will continue, but the analyzer may not work fully
    echo Press Ctrl+C to cancel or any key to continue...
    pause >nul
)

REM Build with PyInstaller
echo.
echo [5/6] Building executable with PyInstaller...
pyinstaller analyzer.spec
if errorlevel 1 (
    echo ERROR: Build failed
    exit /b 1
)

REM Create distribution package
echo.
echo [6/6] Creating distribution package...
if not exist "dist\git-analyzer" mkdir "dist\git-analyzer"

REM Copy executable
copy "dist\analyzer.exe" "dist\git-analyzer\analyzer.exe" >nul 2>&1

REM Copy tools if they exist
if exist "tools" (
    if not exist "dist\git-analyzer\tools" mkdir "dist\git-analyzer\tools"
    if exist "tools\scc.exe" copy "tools\scc.exe" "dist\git-analyzer\tools\" >nul 2>&1
    if exist "tools\trivy.exe" copy "tools\trivy.exe" "dist\git-analyzer\tools\" >nul 2>&1
    if exist "tools\cm.jar" copy "tools\cm.jar" "dist\git-analyzer\tools\" >nul 2>&1
)

REM Copy README
if exist "README_STANDALONE.md" copy "README_STANDALONE.md" "dist\git-analyzer\README.txt" >nul 2>&1

REM Create results directory placeholder
if not exist "dist\git-analyzer\results" mkdir "dist\git-analyzer\results"
echo Results will be saved here > "dist\git-analyzer\results\README.txt"

echo.
echo ============================================================================
echo Build Complete!
echo ============================================================================
echo.
echo Distribution package created in: dist\git-analyzer\
echo.
echo Package contents:
dir "dist\git-analyzer" /B
echo.
echo To test the analyzer:
echo   cd dist\git-analyzer
echo   analyzer.exe --repo C:\path\to\git\repo
echo.
echo To distribute:
echo   1. Compress the git-analyzer folder to a ZIP file
echo   2. Distribute the ZIP file
echo   3. Users extract and run analyzer.exe
echo.
echo IMPORTANT: Users need Git installed on their system!
echo.
echo ============================================================================

pause

