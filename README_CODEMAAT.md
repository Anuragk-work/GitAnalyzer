# CodeMaat Analyzer - Quick Reference

## What is CodeMaat?

CodeMaat analyzes your Git history to provide insights into:
- 🔥 **Hotspots** - Files that change frequently and may need refactoring
- 👥 **Ownership** - Who owns what parts of the codebase
- 🔗 **Coupling** - Files that change together (architectural dependencies)
- 📊 **Churn** - Code instability indicators
- 🎯 **Effort** - Where development effort is spent
- 💬 **Communication** - Team collaboration patterns

---

## Quick Start

### 1. Install Java

```bash
# Check if Java is installed
java -version

# If not installed:
# Windows: Download from https://www.oracle.com/java/technologies/downloads/
# Mac: brew install openjdk
# Linux: sudo apt-get install default-jre
```

### 2. Configure Paths (Optional but Recommended)

Edit the configuration section at the top of `codemaat_analyzer.py`:

```python
# Edit these lines in codemaat_analyzer.py
DEFAULT_REPO_PATH = Path("/path/to/your/repo")
DEFAULT_OUTPUT_DIR = Path("/custom/output")
DEFAULT_JAR_PATH = Path("/path/to/cm.jar")
DEFAULT_JAVA_PATH = "/path/to/java"
DEFAULT_GIT_PATH = "/path/to/git"
```

### 3. Run Analysis

```bash
# If you configured paths in the script:
python codemaat_analyzer.py

# Or use command-line arguments:
python codemaat_analyzer.py --repo /path/to/repo

# Results saved to: results/<repo_name>/
```

### 3. View Results

```bash
# Check the JSON files in results/<repo_name>/
# Each file contains specific analysis data
```

---

## What You Get

### 15 Analysis Types

All analyses run automatically in parallel:

1. **revisions** - Change frequency per file
2. **authors** - Contributor counts
3. **entity-churn** - Lines added/deleted
4. **coupling** - Files changed together
5. **communication** - Developer collaboration
6. **main-dev** - Primary file owners
7. **entity-effort** - Development effort
8. **abs-churn** - Absolute churn metrics
9. **age** - File stability
10. **author-churn** - Per-author contributions
11. **entity-ownership** - Ownership percentages
12. **fragmentation** - Development focus
13. **soc** - Sum of coupling
14. **main-dev-by-revs** - Ownership by revisions
15. **refactoring-main-dev** - Refactoring patterns

### Output Files

```
results/<repo_name>/
├── git-log-codemaat.txt              # Extracted Git log
├── codemaat-all-analyses.json        # All results combined
└── codemaat-<analysis>.json          # Individual analysis files (15 files)
```

---

## Common Use Cases

### Find Hotspots (Files to Refactor)

```bash
python codemaat_analyzer.py --repo /path/to/repo

# Check: codemaat-revisions.json
# Look for high "n-revs" values = files that change a lot
```

### Find Code Owners

```bash
# Check: codemaat-main-dev.json
# Shows primary developer for each file
```

### Detect Architectural Issues

```bash
# Check: codemaat-coupling.json
# High coupling = files that change together often
# May indicate tight coupling or feature relationships
```

### Analyze Team Collaboration

```bash
# Check: codemaat-communication.json
# Shows which developers work on same files
```

---

## Configuration Methods

### Method 1: In-Script Configuration (Recommended)

Edit the configuration section at the top of `codemaat_analyzer.py`:

```python
DEFAULT_REPO_PATH = Path("/path/to/repo")
DEFAULT_OUTPUT_DIR = Path("/custom/output")
DEFAULT_JAR_PATH = Path("/path/to/cm.jar")
DEFAULT_JAVA_PATH = "/usr/lib/jvm/java-11/bin/java"
DEFAULT_GIT_PATH = "/usr/bin/git"
DEFAULT_PARALLEL = True
DEFAULT_MAX_WORKERS = 5
DEFAULT_VERBOSE = False
```

Then just run:
```bash
python codemaat_analyzer.py
```

### Method 2: Command-Line Arguments

```bash
# Basic usage
python codemaat_analyzer.py --repo /path/to/repo

# Custom output directory
python codemaat_analyzer.py --repo /path/to/repo --output /custom/output

# Custom Java path
python codemaat_analyzer.py --repo /path/to/repo --java /path/to/java

# Complete custom setup
python codemaat_analyzer.py \
  --repo /path/to/repo \
  --output /custom/output \
  --jar /path/to/cm.jar \
  --java /path/to/java

# Sequential mode
python codemaat_analyzer.py --repo /path/to/repo --sequential

# Verbose logging
python codemaat_analyzer.py --repo /path/to/repo --verbose
```

### Method 3: Environment Variables

```bash
# Linux/Mac
export CODEMAAT_JAR_PATH=/path/to/cm.jar
export CODEMAAT_JAVA_PATH=/path/to/java
export CODEMAAT_GIT_PATH=/path/to/git
export CODEMAAT_OUTPUT_DIR=/custom/output

python codemaat_analyzer.py --repo /path/to/repo

# Windows
set CODEMAAT_JAR_PATH=C:\path\to\cm.jar
set CODEMAAT_JAVA_PATH=C:\Java\bin\java.exe
python codemaat_analyzer.py --repo C:\repos\myapp
```

### Priority Order

Configuration is resolved in this order (highest to lowest):
1. **Command-line arguments** (highest priority)
2. **Environment variables**
3. **Script configuration** (DEFAULT_* values)
4. **Auto-detection** (lowest priority)

---

## Requirements

✅ **Java** - JRE 8 or later (required)  
✅ **Git** - Must be in system PATH  
✅ **CodeMaat JAR** - Already bundled in `tools/cm.jar` (~38MB)  
✅ **Python 3.9+** - For running the analyzer

---

## Troubleshooting

### "Java not found"
```bash
# Install Java:
# Windows: https://www.oracle.com/java/technologies/downloads/
# Mac: brew install openjdk
# Linux: sudo apt-get install default-jre
```

### "Not a Git repository"
```bash
# Ensure you're analyzing a cloned Git repository
# The directory must contain a .git folder
```

### Out of Memory
```bash
# Increase Java heap size
export JAVA_OPTS="-Xmx4g"
python codemaat_analyzer.py --repo /path/to/repo
```

---

## Example Output

```
============================================================
CodeMaat Evolution Analysis
============================================================
Repository: myapp
Output: results/myapp
============================================================

✅ All requirements met
   Java: Available
   Git: Available
   CodeMaat: tools/cm.jar

📋 Extracting Git log in CodeMaat format...
✅ Git log extracted: 12,543 lines

🔄 Running 15 CodeMaat analyses...
   Mode: Parallel

✅ revisions: 234 entries
✅ authors: 189 entries
✅ entity-churn: 234 entries
...

📊 Analysis Summary:
   Total: 15
   Successful: 15
   Failed: 0

💾 Saving results...
✅ Combined results: codemaat-all-analyses.json
   ✅ Individual files: 15 JSON files

============================================================
✅ CodeMaat Analysis Complete!
============================================================
```

---

## Performance

| Repository Size | Commits | Time (Parallel) |
|-----------------|---------|-----------------|
| Small           | < 1K    | 10-30 seconds   |
| Medium          | 1K-10K  | 30-90 seconds   |
| Large           | 10K-50K | 1-3 minutes     |
| Very Large      | > 50K   | 3-10 minutes    |

---

## Full Documentation

See **CODEMAAT_GUIDE.md** for:
- Detailed analysis type descriptions
- Integration examples
- Advanced usage
- Performance tuning
- Complete API reference

---

## Credits

**CodeMaat** by Adam Tornhill  
https://github.com/adamtornhill/code-maat

**Books:**
- Your Code as a Crime Scene
- Software Design X-Rays

