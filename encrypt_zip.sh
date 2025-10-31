#!/bin/bash
# Create password-protected ZIP for cm.jar
# Password: GitAnalyzer2024

cd "$(dirname "$0")"

# Create password-protected ZIP using standard ZIP encryption
# This works on Windows, macOS, and Linux without additional tools
echo "Creating password-protected cm.jar.zip..."
echo "Password will be: GitAnalyzer2024"

# Use standard zip encryption (compatible everywhere)
zip -P GitAnalyzer2024 cm.jar.zip tools/cm.jar

echo ""
echo "Created: cm.jar.zip"
ls -lh cm.jar.zip
echo ""
echo "To extract on Windows:"
echo "  Right-click -> Extract All"
echo "  Enter password: GitAnalyzer2024"

