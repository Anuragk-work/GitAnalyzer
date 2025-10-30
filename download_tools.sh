#!/bin/bash
# Download External Tools for Git Analyzer
# Run this script to download SCC and Trivy automatically

set -e

TOOLS_DIR="$(cd "$(dirname "$0")/tools" && pwd)"
echo "Installing tools to: $TOOLS_DIR"
echo ""

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     PLATFORM="linux";;
    Darwin*)    PLATFORM="mac";;
    CYGWIN*)    PLATFORM="windows";;
    MINGW*)     PLATFORM="windows";;
    *)          PLATFORM="unknown";;
esac

echo "Detected platform: $PLATFORM"
echo ""

# Download SCC
echo "=== Downloading SCC (Source Code Counter) ==="
SCC_VERSION="3.3.5"

if [ "$PLATFORM" = "mac" ]; then
    # Download macOS ARM64 version
    SCC_URL="https://github.com/boyter/scc/releases/download/v${SCC_VERSION}/scc_${SCC_VERSION}_macOS_arm64.tar.gz"
    echo "Downloading SCC ${SCC_VERSION} for macOS (ARM64)..."
    curl -L -o /tmp/scc.tar.gz "$SCC_URL"
    tar -xzf /tmp/scc.tar.gz -C "$TOOLS_DIR" scc
    chmod +x "$TOOLS_DIR/scc"
    rm /tmp/scc.tar.gz
    echo "✅ SCC downloaded to $TOOLS_DIR/scc"
    
    # Also download Windows version for packaging
    SCC_WIN_URL="https://github.com/boyter/scc/releases/download/v${SCC_VERSION}/scc-${SCC_VERSION}-x86_64-pc-windows.zip"
    echo "Downloading SCC for Windows (for package)..."
    curl -L -o /tmp/scc-win.zip "$SCC_WIN_URL"
    unzip -q -j /tmp/scc-win.zip "scc.exe" -d "$TOOLS_DIR"
    rm /tmp/scc-win.zip
    echo "✅ SCC Windows binary downloaded to $TOOLS_DIR/scc.exe"
elif [ "$PLATFORM" = "linux" ]; then
    # Download Linux version
    SCC_URL="https://github.com/boyter/scc/releases/download/v${SCC_VERSION}/scc_${SCC_VERSION}_Linux_x86_64.tar.gz"
    echo "Downloading SCC ${SCC_VERSION} for Linux..."
    curl -L -o /tmp/scc.tar.gz "$SCC_URL"
    tar -xzf /tmp/scc.tar.gz -C "$TOOLS_DIR" scc
    chmod +x "$TOOLS_DIR/scc"
    rm /tmp/scc.tar.gz
    echo "✅ SCC downloaded to $TOOLS_DIR/scc"
    
    # Also download Windows version for packaging
    SCC_WIN_URL="https://github.com/boyter/scc/releases/download/v${SCC_VERSION}/scc-${SCC_VERSION}-x86_64-pc-windows.zip"
    echo "Downloading SCC for Windows (for package)..."
    curl -L -o /tmp/scc-win.zip "$SCC_WIN_URL"
    unzip -q -j /tmp/scc-win.zip "scc.exe" -d "$TOOLS_DIR"
    rm /tmp/scc-win.zip
    echo "✅ SCC Windows binary downloaded to $TOOLS_DIR/scc.exe"
elif [ "$PLATFORM" = "windows" ]; then
    # Download Windows version only
    SCC_WIN_URL="https://github.com/boyter/scc/releases/download/v${SCC_VERSION}/scc-${SCC_VERSION}-x86_64-pc-windows.zip"
    echo "Downloading SCC ${SCC_VERSION} for Windows..."
    curl -L -o /tmp/scc-win.zip "$SCC_WIN_URL"
    unzip -q -j /tmp/scc-win.zip "scc.exe" -d "$TOOLS_DIR"
    rm /tmp/scc-win.zip
    echo "✅ SCC downloaded to $TOOLS_DIR/scc.exe"
else
    echo "❌ Unsupported platform: $PLATFORM"
    exit 1
fi
echo ""

# Download Trivy
echo "=== Downloading Trivy (Vulnerability Scanner) ==="
if [ "$PLATFORM" = "mac" ]; then
    TRIVY_VERSION="0.56.2"
    TRIVY_URL="https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_macOS-ARM64.tar.gz"
    echo "Downloading Trivy ${TRIVY_VERSION} for macOS (ARM64)..."
    curl -L -o /tmp/trivy.tar.gz "$TRIVY_URL"
    tar -xzf /tmp/trivy.tar.gz -C "$TOOLS_DIR" trivy
    chmod +x "$TOOLS_DIR/trivy"
    rm /tmp/trivy.tar.gz
    echo "✅ Trivy downloaded to $TOOLS_DIR/trivy"
    
    # Download Windows version for packaging
    TRIVY_WIN_URL="https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_windows-64bit.zip"
    echo "Downloading Trivy for Windows (for package)..."
    curl -L -o /tmp/trivy-win.zip "$TRIVY_WIN_URL"
    unzip -q -j /tmp/trivy-win.zip "trivy.exe" -d "$TOOLS_DIR"
    rm /tmp/trivy-win.zip
    echo "✅ Trivy Windows binary downloaded to $TOOLS_DIR/trivy.exe"
    
    # Download Trivy DB using local binary
    echo "Downloading Trivy vulnerability database (this may take a few minutes)..."
    TRIVY_CACHE_DIR="$TOOLS_DIR/trivy-cache"
    mkdir -p "$TRIVY_CACHE_DIR"
    TRIVY_CACHE_DIR="$TRIVY_CACHE_DIR" "$TOOLS_DIR/trivy" image --download-db-only
    echo "✅ Trivy database cached to $TRIVY_CACHE_DIR"
elif [ "$PLATFORM" = "linux" ]; then
    TRIVY_VERSION="0.56.2"
    TRIVY_URL="https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz"
    echo "Downloading Trivy ${TRIVY_VERSION} for Linux..."
    curl -L -o /tmp/trivy.tar.gz "$TRIVY_URL"
    tar -xzf /tmp/trivy.tar.gz -C "$TOOLS_DIR" trivy
    chmod +x "$TOOLS_DIR/trivy"
    rm /tmp/trivy.tar.gz
    echo "✅ Trivy downloaded to $TOOLS_DIR/trivy"
    
    # Download Windows version for packaging
    TRIVY_WIN_URL="https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_windows-64bit.zip"
    echo "Downloading Trivy for Windows (for package)..."
    curl -L -o /tmp/trivy-win.zip "$TRIVY_WIN_URL"
    unzip -q -j /tmp/trivy-win.zip "trivy.exe" -d "$TOOLS_DIR"
    rm /tmp/trivy-win.zip
    echo "✅ Trivy Windows binary downloaded to $TOOLS_DIR/trivy.exe"
    
    # Download Trivy DB using local binary
    echo "Downloading Trivy vulnerability database (this may take a few minutes)..."
    TRIVY_CACHE_DIR="$TOOLS_DIR/trivy-cache"
    mkdir -p "$TRIVY_CACHE_DIR"
    TRIVY_CACHE_DIR="$TRIVY_CACHE_DIR" "$TOOLS_DIR/trivy" image --download-db-only
    echo "✅ Trivy database cached to $TRIVY_CACHE_DIR"
elif [ "$PLATFORM" = "windows" ]; then
    TRIVY_VERSION="0.56.2"
    TRIVY_WIN_URL="https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_windows-64bit.zip"
    echo "Downloading Trivy ${TRIVY_VERSION} for Windows..."
    curl -L -o /tmp/trivy-win.zip "$TRIVY_WIN_URL"
    unzip -q -j /tmp/trivy-win.zip "trivy.exe" -d "$TOOLS_DIR"
    rm /tmp/trivy-win.zip
    echo "✅ Trivy downloaded to $TOOLS_DIR/trivy.exe"
    
    # Download Trivy DB
    echo "Downloading Trivy vulnerability database (this may take a few minutes)..."
    TRIVY_CACHE_DIR="$TOOLS_DIR/trivy-cache"
    mkdir -p "$TRIVY_CACHE_DIR"
    "$TOOLS_DIR/trivy.exe" image --download-db-only --cache-dir "$TRIVY_CACHE_DIR"
    echo "✅ Trivy database cached to $TRIVY_CACHE_DIR"
else
    echo "❌ Unsupported platform: $PLATFORM"
    exit 1
fi
echo ""

# Download CodeMaat (Optional)
echo "=== Downloading CodeMaat (Evolution Analysis) - Optional ==="
CM_VERSION="1.0.4"
CM_URL="https://github.com/adamtornhill/code-maat/releases/download/v${CM_VERSION}/code-maat-${CM_VERSION}-standalone.jar"
echo "Downloading CodeMaat ${CM_VERSION}..."
if curl -L -o "$TOOLS_DIR/cm.jar" "$CM_URL" 2>/dev/null; then
    echo "✅ CodeMaat downloaded to $TOOLS_DIR/cm.jar"
    echo "   Note: Requires Java Runtime Environment to run"
else
    echo "⚠️  CodeMaat download failed (optional tool)"
fi
echo ""

# Install Lizard (Python package)
echo "=== Installing Lizard (Code Complexity Analyzer) ==="
if command -v pip3 >/dev/null 2>&1; then
    pip3 install lizard --upgrade
    echo "✅ Lizard installed via pip"
elif command -v pip >/dev/null 2>&1; then
    pip install lizard --upgrade
    echo "✅ Lizard installed via pip"
else
    echo "❌ pip not found - Lizard will be bundled in the executable"
fi
echo ""

echo "============================================"
echo "Tool Download Complete!"
echo "============================================"
echo ""
echo "Downloaded to $TOOLS_DIR:"
ls -lh "$TOOLS_DIR" | grep -v "^total" | grep -v "^d" || true
echo ""
echo "Trivy database:"
if [ -d "$TOOLS_DIR/trivy-cache" ]; then
    DB_SIZE=$(du -sh "$TOOLS_DIR/trivy-cache" 2>/dev/null | cut -f1)
    echo "  ✅ Cached (~$DB_SIZE) - Ready for offline use"
else
    echo "  ⚠️  Not found"
fi
echo ""
echo "✅ All tools bundled in tools/ directory"
echo "✅ Ready to create package with: ./create_package.sh"
echo ""
echo "Next steps:"
echo "  1. Test locally: python3 standalone_analyzer.py --repo /path/to/repo"
echo "  2. Create package: ./create_package.sh"
echo "  3. Transfer package to Windows device"
echo ""

