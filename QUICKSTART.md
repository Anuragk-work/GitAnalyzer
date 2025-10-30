# Quick Start Guide

## For Package Preparers (Mac/Linux with Internet)

### 1. Download Everything
```bash
./download_tools.sh
```
Downloads SCC, Trivy, and **Trivy vulnerability database** (~200MB).

### 2. Create Package
```bash
./create_package.sh
```
Creates `git-analyzer-windows-complete_[timestamp].zip`.

### 3. Transfer to Windows
Copy ZIP to Windows device via USB or network share.

---

## For Windows Users (Offline)

### 1. Extract Package
```cmd
unzip git-analyzer-windows-complete.zip
cd git-analyzer-windows-complete
```

### 2. Install Dependencies (One-time)
```cmd
pip install -r requirements.txt
```

### 3. Analyze Repository
```cmd
python standalone_analyzer.py --repo C:\path\to\cloned\repo
```

### 4. Get Results
Results saved to: `results\<repo-name>\`

---

## Common Use Cases

### Analyze with All Tools
```cmd
python standalone_analyzer.py --repo C:\repos\myapp --tools all
```

### Only Vulnerability Scan
```cmd
python standalone_analyzer.py --repo C:\repos\myapp --tools vulnerability
```

### Custom Output Location
```cmd
python standalone_analyzer.py --repo C:\repos\myapp --output C:\analysis
```

---

## Key Points

✅ **No internet required on Windows**  
✅ **Trivy database pre-cached** (~200MB in `tools/trivy-cache/`)  
✅ **All tools bundled**  
✅ **JSON output** for easy integration

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Git not found" | Install Git for Windows |
| "Trivy database not found" | Verify `tools/trivy-cache/` exists |
| "Module not found" | Run `pip install -r requirements.txt` |

---

See **README.md** for complete documentation.

