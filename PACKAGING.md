# Packaging for Offline Windows Deployment

This guide explains how to create a complete, offline-ready package for Windows devices that may not have internet access.

## Overview

The Windows devices where this analyzer will run may not have internet connectivity. Therefore, we need to:
1. Download all tools and databases on an internet-connected machine (Mac/Linux)
2. Package everything together
3. Transfer the complete package to Windows devices

---

## Preparation (Internet-Connected Machine)

### 1. Download All External Tools

Run the download script on a Mac or Linux machine with internet access:

```bash
./download_tools.sh
```

This will download:
- SCC binary
- Trivy binary  
- **Trivy vulnerability database (~200MB)** stored in `tools/trivy-cache/`
- Lizard (Python package)

### 2. Verify Downloads

Check that all tools are present:

```bash
ls -lh tools/
```

You should see:
- `scc` (or `scc.exe`)
- `trivy` (or `trivy.exe`) 
- `trivy-cache/` directory (~200MB)
- `cm.jar` (optional)

---

## Windows Packaging Options

### Option A: Create ZIP Package for Manual Transfer

1. **Create the package:**
   ```bash
   cd git-analyzer-standalone
   zip -r git-analyzer-complete.zip \
     standalone_analyzer.py \
     requirements.txt \
     tools/ \
     results/ \
     README.md \
     QUICKSTART.md \
     START_HERE.txt \
     LICENSE
   ```

2. **Transfer to Windows:**
   - Copy `git-analyzer-complete.zip` to USB drive or network share
   - Extract on Windows device
   - No internet required on Windows!

### Option B: Build Windows Executable (Requires Windows/CI)

For a true single-executable experience:

1. **Use GitHub Actions** (recommended):
   - Push to GitHub with a release tag
   - GitHub Actions will build on Windows Server
   - Download the built executable + tools bundle

2. **Or build on Windows machine:**
   ```cmd
   build_windows.bat
   ```

---

## Package Contents

The final package for Windows should include:

```
git-analyzer/
├── analyzer.exe              (if built) or standalone_analyzer.py
├── tools/
│   ├── scc.exe              (Windows binary)
│   ├── trivy.exe            (Windows binary)
│   ├── trivy-cache/         (Vulnerability database - ~200MB)
│   │   └── db/              (Database files)
│   ├── cm.jar               (Optional - CodeMaat)
│   └── README.txt
├── results/                  (Output directory)
├── README.md
├── QUICKSTART.md
├── START_HERE.txt
└── LICENSE
```

---

## Key Points for Offline Operation

### ✅ Trivy Offline Scanning
- The `trivy-cache/` directory contains the complete vulnerability database
- Trivy will use `--skip-db-update` flag automatically
- No internet connection needed for scanning

### ✅ All Tools Bundled
- SCC, Trivy, and CodeMaat binaries are included
- No external downloads during analysis

### ⚠️ Initial Setup Only
- Only the **package creator** needs internet access
- **End users on Windows** do NOT need internet
- Trivy database can be updated periodically by re-running download script

---

## Updating Vulnerability Database

To keep the vulnerability database current:

1. **On internet-connected machine:**
   ```bash
   cd git-analyzer-standalone/tools
   TRIVY_CACHE_DIR=./trivy-cache trivy image --download-db-only
   ```

2. **Re-package and redistribute:**
   - Create new ZIP with updated cache
   - Deploy to Windows devices

---

## Distribution Workflow

```
┌─────────────────────────────────────────┐
│ Internet-Connected Machine (Mac/Linux)  │
│                                          │
│ 1. Run: ./download_tools.sh             │
│    Downloads: SCC, Trivy, Trivy DB      │
│                                          │
│ 2. Package: zip -r package.zip ...      │
└──────────────┬──────────────────────────┘
               │
               │ USB / Network Share
               │
               ▼
┌─────────────────────────────────────────┐
│ Offline Windows Device                   │
│                                          │
│ 1. Extract package                       │
│ 2. Run: analyzer.exe --repo <path>      │
│    ✓ Works completely offline           │
│    ✓ Uses cached Trivy database         │
└─────────────────────────────────────────┘
```

---

## Package Size Estimate

- Standalone script: ~50 KB
- SCC binary: ~8 MB
- Trivy binary: ~80 MB
- **Trivy database: ~200 MB**
- Total: **~290 MB**

When built as executable with PyInstaller: Add ~20-30 MB for Python runtime.

---

## Testing the Package

Before deploying to Windows:

1. **Disconnect from internet** (to simulate offline environment)
2. **Run a test analysis:**
   ```bash
   ./standalone_analyzer.py --repo /path/to/test/repo --tools all
   ```
3. **Verify all tools work:**
   - Check console output for tool execution
   - Verify JSON files are created in `results/`
   - Confirm Trivy uses cached database (look for log message)

---

## Troubleshooting

**Q: Package is too large**
- The Trivy database is ~200MB - this is expected and necessary for offline operation
- Consider network share deployment if USB transfer is impractical

**Q: Trivy database is outdated**
- Re-run download script on internet-connected machine
- Re-package and redistribute

**Q: Tools not found on Windows**
- Verify tools directory structure is preserved
- Check that file permissions were maintained during transfer

---

## Security Considerations

- The Trivy database contains vulnerability information (public data)
- Package can be safely transferred via USB or network share
- No sensitive credentials or keys are included
- All tools are official releases from trusted sources

