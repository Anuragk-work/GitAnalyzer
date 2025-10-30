External Tools Directory
========================

📥 AUTOMATIC DOWNLOAD (RECOMMENDED)
===================================

Run the download script to automatically get all tools AND the Trivy database:

Windows:
  .\download_tools.ps1

Mac/Linux:
  ./download_tools.sh

This will download:
  - SCC binary
  - Trivy binary
  - Trivy vulnerability database (~200MB, stored in trivy-cache/)
  - Lizard (Python package)


📦 MANUAL DOWNLOAD (Alternative)
=================================

If automatic download fails, download manually:

Windows:
--------
1. scc.exe - Code Counter
   Download from: https://github.com/boyter/scc/releases
   File: scc-3.3.5-x86_64-pc-windows.zip
   Extract scc.exe to this directory

2. trivy.exe - Vulnerability Scanner
   Download from: https://github.com/aquasecurity/trivy/releases
   File: trivy_0.56.2_windows-64bit.zip
   Extract trivy.exe to this directory
   
   IMPORTANT: After extracting, download the vulnerability database:
   trivy image --download-db-only --cache-dir tools/trivy-cache
   
   This creates a trivy-cache/ folder (~200MB) for offline scanning

3. cm.jar - CodeMaat (Optional)
   Download from: https://github.com/adamtornhill/code-maat/releases
   File: code-maat-1.0.4-standalone.jar
   Copy to this directory
   Note: Requires Java Runtime Environment

macOS/Linux:
------------
Run: ./download_tools.sh
Or use Homebrew:
  brew install scc
  brew install aquasecurity/trivy/trivy


🔍 TOOL LOOKUP ORDER
====================

The analyzer searches for tools in this order:
1. This tools/ directory (next to the executable)
2. System PATH (if installed globally)

If tools are not found, those specific analyses will be skipped.


✅ VERIFICATION
===============

After download, verify the tools are present:
  Windows: dir
  Mac/Linux: ls -lh

You should see:
  - scc.exe or scc (executable)
  - trivy.exe or trivy (executable)
  - trivy-cache/ (vulnerability database directory)
  - cm.jar (optional)


📦 TRIVY DATABASE CACHE
========================

The trivy-cache/ directory contains the Trivy vulnerability database.
This allows completely offline scanning without internet access.

Size: ~200MB
Purpose: Vulnerability definitions for security scanning
Updates: Re-run download script periodically for latest vulnerabilities

