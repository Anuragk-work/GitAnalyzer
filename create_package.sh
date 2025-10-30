#!/bin/bash

# Package creation script for offline Windows deployment
# This script creates a complete package with all tools and databases

set -e

echo "================================================================"
echo "Git Analyzer - Complete Offline Package Creator"
echo "================================================================"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PACKAGE_NAME="git-analyzer-windows-complete"
PACKAGE_DIR="${PACKAGE_NAME}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_ZIP="${PACKAGE_NAME}_${TIMESTAMP}.zip"

# Step 1: Check if tools are downloaded
echo "📋 Step 1: Checking for required tools..."
MISSING_TOOLS=0

if [ ! -d "tools/trivy-cache" ] || [ -z "$(ls -A tools/trivy-cache 2>/dev/null)" ]; then
    echo "❌ Trivy database not found in tools/trivy-cache/"
    MISSING_TOOLS=1
fi

if [ ! -f "tools/scc" ] && [ ! -f "tools/scc.exe" ]; then
    echo "❌ SCC binary not found"
    MISSING_TOOLS=1
fi

if [ ! -f "tools/trivy" ] && [ ! -f "tools/trivy.exe" ]; then
    echo "❌ Trivy binary not found"
    MISSING_TOOLS=1
fi

if [ $MISSING_TOOLS -eq 1 ]; then
    echo ""
    echo "⚠️  Some tools are missing. Would you like to download them now? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "Running download_tools.sh..."
        ./download_tools.sh
    else
        echo "❌ Cannot create package without tools. Exiting."
        exit 1
    fi
fi

echo "✅ All tools present"
echo ""

# Step 2: Check Trivy database size
echo "📊 Step 2: Verifying Trivy database..."
if [ -d "tools/trivy-cache" ]; then
    DB_SIZE=$(du -sh tools/trivy-cache | cut -f1)
    echo "   Trivy database size: $DB_SIZE"
    echo "✅ Database ready for offline use"
else
    echo "❌ Trivy database missing!"
    exit 1
fi
echo ""

# Step 3: For Windows, we need Windows binaries
echo "🪟 Step 3: Windows binary check..."
echo ""
echo "IMPORTANT: This package is for OFFLINE WINDOWS deployment."
echo "You need Windows versions of the tools:"
echo ""
echo "  - scc.exe (not just 'scc')"
echo "  - trivy.exe (not just 'trivy')"
echo ""
echo "Current tools directory:"
ls -lh tools/ | grep -E '\.(exe|jar)$' || echo "  No .exe files found"
echo ""
echo "If you don't have Windows binaries yet:"
echo "  1. Download manually from GitHub releases"
echo "  2. Or use GitHub Actions to build automatically"
echo ""
echo "Continue with current tools? (y/n)"
read -r response
if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "Package creation cancelled."
    exit 0
fi
echo ""

# Step 4: Create package directory
echo "📦 Step 4: Creating package structure..."
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

# Copy files
cp standalone_analyzer.py "$PACKAGE_DIR/"
cp requirements.txt "$PACKAGE_DIR/"
cp README.md "$PACKAGE_DIR/"
cp QUICKSTART.md "$PACKAGE_DIR/"
cp START_HERE.txt "$PACKAGE_DIR/"
cp LICENSE "$PACKAGE_DIR/"
cp PACKAGING.md "$PACKAGE_DIR/"

# Copy tools directory with all contents (including trivy-cache)
echo "   Copying tools directory (this may take a moment due to database size)..."
cp -r tools "$PACKAGE_DIR/"

# Create empty results directory
mkdir -p "$PACKAGE_DIR/results"
echo "Output directory for analysis results" > "$PACKAGE_DIR/results/README.txt"

echo "✅ Package structure created"
echo ""

# Step 5: Create deployment instructions
echo "📝 Step 5: Creating deployment instructions..."
cat > "$PACKAGE_DIR/DEPLOY_TO_WINDOWS.txt" << 'EOF'
================================
WINDOWS DEPLOYMENT INSTRUCTIONS
================================

This package is ready for OFFLINE Windows deployment.

REQUIREMENTS ON WINDOWS:
- Windows 10 or 11 (64-bit)
- Git for Windows (https://git-scm.com/download/win)
- Python 3.9+ (only if using .py script instead of .exe)

DEPLOYMENT STEPS:
1. Copy this entire folder to Windows device (USB/Network)
2. Extract to: C:\Tools\git-analyzer\ (or your preferred location)
3. Verify tools\trivy-cache\ directory exists (~200MB)
4. Open Command Prompt in this directory

QUICK TEST:
  python standalone_analyzer.py --version

USAGE:
  python standalone_analyzer.py --repo C:\path\to\cloned\repo

OUTPUT:
  Results saved to: results\<repo_name>\

OFFLINE OPERATION:
✓ No internet connection required
✓ Trivy uses cached vulnerability database
✓ All tools bundled and ready

See README.md for complete documentation.
EOF

echo "✅ Deployment instructions created"
echo ""

# Step 6: Calculate package size
echo "📊 Step 6: Package statistics..."
TOTAL_SIZE=$(du -sh "$PACKAGE_DIR" | cut -f1)
TOOLS_SIZE=$(du -sh "$PACKAGE_DIR/tools" | cut -f1)
CACHE_SIZE=$(du -sh "$PACKAGE_DIR/tools/trivy-cache" 2>/dev/null | cut -f1 || echo "N/A")

echo "   Package directory: $TOTAL_SIZE"
echo "   Tools directory:   $TOOLS_SIZE"
echo "   Trivy cache:       $CACHE_SIZE"
echo ""

# Step 7: Create ZIP archive
echo "🗜️  Step 7: Creating ZIP archive..."
echo "   This may take a moment..."

if command -v zip >/dev/null 2>&1; then
    zip -r -q "$OUTPUT_ZIP" "$PACKAGE_DIR"
    ZIP_SIZE=$(du -sh "$OUTPUT_ZIP" | cut -f1)
    echo "✅ ZIP created: $OUTPUT_ZIP ($ZIP_SIZE)"
else
    echo "⚠️  'zip' command not found, creating tar.gz instead..."
    tar -czf "${OUTPUT_ZIP%.zip}.tar.gz" "$PACKAGE_DIR"
    TAR_SIZE=$(du -sh "${OUTPUT_ZIP%.zip}.tar.gz" | cut -f1)
    echo "✅ Archive created: ${OUTPUT_ZIP%.zip}.tar.gz ($TAR_SIZE)"
fi
echo ""

# Step 8: Create manifest
echo "📋 Step 8: Creating package manifest..."
cat > "${PACKAGE_NAME}_manifest.txt" << EOF
Package Manifest
Generated: $(date)
================

Package Name: $OUTPUT_ZIP
Total Size: $TOTAL_SIZE

Contents:
---------
$(tree -L 2 "$PACKAGE_DIR" 2>/dev/null || find "$PACKAGE_DIR" -maxdepth 2 -type f)

Tools Included:
--------------
$(ls -lh "$PACKAGE_DIR/tools/" 2>/dev/null | grep -v '^d' | awk '{print $9, "-", $5}' || echo "See tools/ directory")

Trivy Database:
--------------
Location: tools/trivy-cache/
Size: $CACHE_SIZE
Status: Ready for offline use

Deployment Target:
-----------------
Platform: Windows 10/11 (64-bit)
Mode: Offline (no internet required)
EOF

echo "✅ Manifest created: ${PACKAGE_NAME}_manifest.txt"
echo ""

# Summary
echo "================================================================"
echo "✅ PACKAGE CREATION COMPLETE"
echo "================================================================"
echo ""
echo "📦 Package: $OUTPUT_ZIP"
echo "📊 Size: $TOTAL_SIZE (compressed)"
echo "📋 Manifest: ${PACKAGE_NAME}_manifest.txt"
echo ""
echo "NEXT STEPS:"
echo "1. Transfer package to Windows device (USB/Network)"
echo "2. Extract on Windows"
echo "3. Run: python standalone_analyzer.py --repo <path>"
echo ""
echo "💡 TIP: The package includes cached Trivy database for offline scanning"
echo "================================================================"

