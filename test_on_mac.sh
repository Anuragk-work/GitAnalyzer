#!/bin/bash
# Test the standalone analyzer on macOS
# This doesn't create an executable but lets you test functionality

echo "============================================================================"
echo "Standalone Git Analyzer - Mac Testing Script"
echo "============================================================================"
echo

# Check Python
echo "[1/4] Checking Python..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found"
    echo "Install with: brew install python3"
    exit 1
fi
python3 --version

# Install dependencies
echo
echo "[2/4] Installing dependencies..."
pip3 install -r requirements_standalone.txt

# Download external tools for Mac (optional)
echo
echo "[3/4] Setting up external tools..."
echo "Note: External tools are optional for testing"

# SCC for Mac
if ! command -v scc &> /dev/null; then
    echo "Installing SCC..."
    brew install scc || echo "⚠️  SCC not installed (optional)"
else
    echo "✅ SCC found"
fi

# Trivy for Mac
if ! command -v trivy &> /dev/null; then
    echo "Installing Trivy..."
    brew install aquasecurity/trivy/trivy || echo "⚠️  Trivy not installed (optional)"
else
    echo "✅ Trivy found"
fi

# Lizard should be installed via pip
if ! command -v lizard &> /dev/null; then
    echo "Installing Lizard..."
    pip3 install lizard
else
    echo "✅ Lizard found"
fi

# Test
echo
echo "[4/4] Testing analyzer..."
echo
echo "To test, run:"
echo "  python3 standalone_analyzer.py --repo /path/to/git/repo"
echo
echo "Example with a test repo:"
echo "  git clone https://github.com/octocat/Hello-World.git /tmp/test-repo"
echo "  python3 standalone_analyzer.py --repo /tmp/test-repo"
echo
echo "============================================================================"
echo "Setup complete! You can now test the analyzer on Mac."
echo "============================================================================"

