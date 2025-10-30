# Standalone Git Repository Analyzer - Offline Windows Package

A self-contained analyzer for Git repositories designed for **offline Windows environments**. Pre-package on an internet-connected machine, then deploy to Windows devices without internet access.

## Version

**Version:** 1.0.0  
**Build Date:** 2025-10-29  
**Platform:** Windows 10/11 x64 (Offline-capable)

---

## Overview

### The Problem
Many enterprise Windows environments have restricted or no internet access, making it difficult to use tools that require online database updates (like vulnerability scanners).

### The Solution
This analyzer solves that by:
1. **Pre-downloading everything** on an internet-connected machine (Mac/Linux)
2. **Bundling the Trivy vulnerability database** (~200MB) for offline scanning
3. **Creating a complete package** that works entirely offline on Windows

---

## Features

### Internal Analysis Tools
- **Repository History Analysis**
  - Commit metrics, author statistics
  - Temporal patterns, file hotspots
  - Code churn, collaboration metrics

- **Commit Classification Analysis**
  - Categorizes commits: features, bugs, refactoring, docs, tests, chores, merges

### External Analysis Tools
- **Tech Stack Analysis (SCC)**
  - Lines of code by language
  - File counts, language distribution

- **Code Quality Analysis (Lizard)**
  - Cyclomatic complexity
  - Function complexity metrics

- **Vulnerability Analysis (Trivy)**
  - Security vulnerability scanning
  - **Offline operation** using pre-cached database
  - Severity classification (Critical/High/Medium/Low)

---

## Two-Phase Deployment Model

```
┌──────────────────────────────────────────┐
│ Phase 1: Package Preparation             │
│ (Internet-Connected Mac/Linux)           │
│                                           │
│ 1. Download tools: ./download_tools.sh   │
│ 2. Create package: ./create_package.sh   │
│ 3. Get: git-analyzer-complete.zip        │
└────────────┬─────────────────────────────┘
             │
             │ Transfer via USB/Network
             │
             ▼
┌──────────────────────────────────────────┐
│ Phase 2: Windows Deployment              │
│ (Offline Windows Device)                 │
│                                           │
│ 1. Extract package                        │
│ 2. Run analyzer                           │
│ 3. Get results - NO INTERNET NEEDED      │
└──────────────────────────────────────────┘
```

---

## Phase 1: Package Preparation (Internet Required)

### Prerequisites
- Mac or Linux machine with internet access
- Bash shell
- `curl` or `wget`
- `zip` command

### Steps

#### 1. Download All Tools and Databases

```bash
cd git-analyzer-standalone
./download_tools.sh
```

This downloads:
- ✅ SCC binary (~8 MB)
- ✅ Trivy binary (~80 MB)
- ✅ **Trivy vulnerability database (~200 MB)** ← Key for offline use
- ✅ Lizard (Python package)

The script will create a `tools/trivy-cache/` directory containing the complete vulnerability database.

#### 2. Get Windows Binaries

The download script works for Mac/Linux. For Windows binaries:

**Option A: Download manually**
- SCC: https://github.com/boyter/scc/releases → `scc.exe`
- Trivy: https://github.com/aquasecurity/trivy/releases → `trivy.exe`
- Place in `tools/` directory

**Option B: Use Windows download script**
If you have access to a Windows machine with internet, run:
```powershell
.\download_tools.ps1
```

#### 3. Create Complete Package

```bash
./create_package.sh
```

This creates:
- `git-analyzer-windows-complete_YYYYMMDD_HHMMSS.zip`
- Complete with all tools, databases, and scripts
- Ready for offline Windows deployment

**Package Contents:**
```
git-analyzer-windows-complete.zip (~300 MB)
├── standalone_analyzer.py
├── requirements.txt
├── tools/
│   ├── scc.exe
│   ├── trivy.exe
│   └── trivy-cache/        ← 200MB vulnerability database
├── results/
├── README.md
├── QUICKSTART.md
└── LICENSE
```

---

## Phase 2: Windows Deployment (Offline)

### Prerequisites on Windows
- **Operating System:** Windows 10 or Windows 11 (64-bit)
- **Git for Windows:** https://git-scm.com/download/win
- **Python 3.9+:** https://www.python.org/downloads/
- **NO INTERNET REQUIRED**

### Deployment Steps

#### 1. Transfer Package
Copy `git-analyzer-windows-complete.zip` to Windows via:
- USB drive
- Network share
- Any file transfer method

#### 2. Extract Package
```cmd
cd C:\Tools
unzip git-analyzer-windows-complete.zip
cd git-analyzer-windows-complete
```

#### 3. Verify Tools
```cmd
dir tools
```

Should show:
- `scc.exe`
- `trivy.exe`
- `trivy-cache\` (directory, ~200 MB)

#### 4. Install Python Dependencies (One-time)
```cmd
pip install -r requirements.txt
```

---

## Usage (On Windows)

### Basic Analysis

```cmd
python standalone_analyzer.py --repo C:\path\to\cloned\repo
```

Results saved to: `results\<repo_name>\`

### Run Specific Tools

```cmd
# Only internal analyses
python standalone_analyzer.py --repo C:\path\to\repo --tools internal

# Only tech stack analysis
python standalone_analyzer.py --repo C:\path\to\repo --tools tech-stack

# Everything
python standalone_analyzer.py --repo C:\path\to\repo --tools all
```

### Custom Output Directory

```cmd
python standalone_analyzer.py --repo C:\repos\myapp --output C:\analysis-results
```

### Available Tools

| Tool Flag | Description |
|-----------|-------------|
| `internal` | Repository history + commit classification |
| `tech-stack` | SCC code counter (language stats) |
| `code-quality` | Lizard complexity analysis |
| `vulnerability` | Trivy security scanning (offline) |
| `evolution` | CodeMaat evolution analysis (requires Java) |
| `all` | Run all available tools |

---

## Offline Operation Details

### How Trivy Works Offline

1. **Preparation Phase:**
   - Download script runs: `trivy image --download-db-only --cache-dir tools/trivy-cache`
   - Creates complete vulnerability database (~200 MB)

2. **Runtime on Windows:**
   - Analyzer detects `tools/trivy-cache/` directory
   - Automatically adds flags: `--cache-dir tools/trivy-cache --skip-db-update`
   - Trivy uses local database, no internet check

3. **Console Output:**
```
🛡️ Running vulnerability analysis...
📦 Using cached Trivy database from tools/trivy-cache
✅ Vulnerability analysis completed
```

### Database Updates

The vulnerability database becomes outdated over time. To update:

1. **On internet-connected machine:**
```bash
cd tools
TRIVY_CACHE_DIR=./trivy-cache trivy image --download-db-only
```

2. **Re-create package:**
```bash
./create_package.sh
```

3. **Redeploy to Windows devices**

**Recommendation:** Update monthly or as needed based on security requirements.

---

## Output Structure

### Results Directory

```
results/
└── <repository-name>/
    ├── extractions/
    │   ├── git_log_all.log
    │   ├── git_log_stats.log
    │   └── git_log_graph.log
    │
    ├── repository-history-analysis.json
    ├── commit-classification-analysis.json
    ├── tech-stack-analysis.json
    ├── code-quality-analysis.json
    └── vulnerability-analysis.json
```

### JSON Output Format

All JSON files follow this structure:

```json
{
  "repository_name": "myrepo",
  "tool": "tool-name",
  "analysis_timestamp": "2025-10-29T10:30:00",
  "success": true,
  // ... tool-specific results ...
}
```

---

## Troubleshooting

### "Git not found"
**Problem:** Git is not installed or not in PATH  
**Solution:**
1. Install Git for Windows: https://git-scm.com/download/win
2. Ensure it's in PATH (default installation does this)
3. Verify: `git --version`

### "Trivy database not found, will download"
**Problem:** `tools/trivy-cache/` directory is missing  
**Solution:**
1. Verify the directory exists and is not empty
2. If missing, re-run `create_package.sh` on prep machine
3. Check that directory was included in ZIP transfer

### "ModuleNotFoundError: No module named 'pandas'"
**Problem:** Python dependencies not installed  
**Solution:**
```cmd
pip install -r requirements.txt
```

### "Permission denied" or "Access denied"
**Problem:** Windows file permissions  
**Solution:**
1. Run Command Prompt as Administrator
2. Or extract to a user-writable directory (not Program Files)

### Slow First Run
**Problem:** Python compiling packages on first import  
**Solution:** This is normal. Subsequent runs will be faster.

### "Analysis failed for <tool>"
**Problem:** Tool binary missing or corrupt  
**Solution:**
1. Verify tool exists: `dir tools\`
2. Check file size (not 0 bytes)
3. Re-download that specific tool manually

---

## Package Size Breakdown

| Component | Size | Purpose |
|-----------|------|---------|
| Python script | ~50 KB | Main analyzer logic |
| SCC binary | ~8 MB | Code counting |
| Trivy binary | ~80 MB | Vulnerability scanning |
| **Trivy database** | **~200 MB** | **Offline vulnerability data** |
| CodeMaat (optional) | ~10 MB | Evolution analysis |
| Python deps (installed) | ~30 MB | pandas, numpy, lizard |
| **Total** | **~330 MB** | Complete offline package |

---

## Security Considerations

### What's in the Package
- ✅ Official tool binaries (SCC, Trivy)
- ✅ Public vulnerability database
- ✅ Open source Python script
- ❌ No credentials or secrets
- ❌ No proprietary code

### Vulnerability Database
- Contains **public** vulnerability information (CVEs)
- Same data available at https://nvd.nist.gov/
- Safe to transfer via USB or network share

### Tool Verification
All tools are from official sources:
- SCC: https://github.com/boyter/scc
- Trivy: https://github.com/aquasecurity/trivy
- Lizard: https://github.com/terryyin/lizard

---

## Advanced Configuration

### Environment Variables

```cmd
# Override tools directory
set ANALYZER_TOOLS_DIR=C:\custom\tools

# Override output directory
set ANALYZER_OUTPUT_DIR=C:\analysis-output

python standalone_analyzer.py --repo C:\repos\myapp
```

### Verbose Logging

```cmd
python standalone_analyzer.py --repo C:\repos\myapp --verbose
```

### Batch Processing

Create a batch file to analyze multiple repositories:

```batch
@echo off
for %%R in (C:\repos\*) do (
    echo Analyzing %%R...
    python standalone_analyzer.py --repo %%R --tools all
)
```

---

## Integration with CI/CD

### GitLab CI Example (Offline Runner)

```yaml
analyze:
  script:
    - python C:\Tools\git-analyzer\standalone_analyzer.py --repo $CI_PROJECT_DIR
    - cp -r results\* $CI_PROJECT_DIR\analysis-results\
  artifacts:
    paths:
      - analysis-results/
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any
    stages {
        stage('Analyze') {
            steps {
                bat 'python C:\\Tools\\git-analyzer\\standalone_analyzer.py --repo %WORKSPACE%'
                archiveArtifacts artifacts: 'results/**/*.json'
            }
        }
    }
}
```

---

## Development and Building

### Testing on Mac/Linux

```bash
./test_on_mac.sh /path/to/test/repo
```

### Building Windows Executable (Optional)

For a true single-file executable (no Python required on Windows):

1. **Using GitHub Actions (Recommended):**
   - Push code to GitHub
   - Tag a release: `git tag v1.0.0 && git push --tags`
   - GitHub Actions builds Windows .exe automatically

2. **On Windows machine:**
   ```cmd
   build_windows.bat
   ```

---

## FAQ

**Q: Why is the package so large?**  
A: The Trivy vulnerability database is ~200 MB. This is necessary for offline operation and contains comprehensive vulnerability data for thousands of packages.

**Q: Can I use this without Python on Windows?**  
A: Yes, if you build the Windows executable (.exe) using PyInstaller. See "Building Windows Executable" section.

**Q: Does this work with GitLab?**  
A: Yes! Clone the GitLab repository first, then run the analyzer on the cloned path.

**Q: How often should I update the vulnerability database?**  
A: Monthly is recommended for enterprise use. Critical environments may want weekly updates.

**Q: Can I analyze private repositories?**  
A: Yes, as long as you can clone them. The analyzer works on any local Git repository.

**Q: What if a tool is missing?**  
A: The analyzer will skip that specific tool and continue with others. Check console output for warnings.

**Q: Can I run this on Linux servers?**  
A: Yes! The Python script works on Mac/Linux. Only the packaging is focused on Windows deployment.

---

## Support and Documentation

- **Full Documentation:** `README.md` (this file)
- **Quick Start:** `QUICKSTART.md`
- **Packaging Guide:** `PACKAGING.md`
- **Tool Information:** `tools/README.txt`

---

## License

MIT License - See `LICENSE` file for details.

---

## Credits

This analyzer bundles the following open-source tools:
- **SCC** by boyter - https://github.com/boyter/scc
- **Trivy** by Aqua Security - https://github.com/aquasecurity/trivy
- **Lizard** by terryyin - https://github.com/terryyin/lizard

---

**Built for offline Windows environments where security and analysis still matter.**

