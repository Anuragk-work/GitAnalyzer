# CodeMaat Evolution Analysis Guide

## Overview

CodeMaat is a powerful code analysis tool that provides insights into code evolution, developer patterns, and architectural health by analyzing Git history.

This standalone analyzer runs **all 15 CodeMaat analysis types** in parallel for comprehensive code evolution insights.

---

## Prerequisites

### Required
- **Java Runtime Environment (JRE) 8 or later**
  - Windows: https://www.oracle.com/java/technologies/downloads/
  - Mac: `brew install openjdk`
  - Linux: `sudo apt-get install default-jre`

- **Git**
  - Must be installed and in system PATH

- **CodeMaat JAR file**
  - Already bundled as `tools/cm.jar` (~38MB)
  - Or download from: https://github.com/adamtornhill/code-maat/releases

---

## Quick Start

### Basic Usage

```bash
# Analyze a repository
python codemaat_analyzer.py --repo /path/to/repo

# Results saved to: results/<repo_name>/
```

### Custom Output Directory

```bash
python codemaat_analyzer.py --repo /path/to/repo --output /path/to/output
```

### Sequential Mode (slower but uses less memory)

```bash
python codemaat_analyzer.py --repo /path/to/repo --sequential
```

---

## Analysis Types

The analyzer runs **all 15 CodeMaat analysis types**:

### Code Evolution Metrics

1. **revisions** - How files change over time
   - Tracks change frequency per file
   - Identifies hotspots

2. **entity-churn** - Frequently changing areas
   - Lines added/deleted per file
   - Code instability indicators

3. **abs-churn** - Absolute churn metrics
   - Total lines changed
   - Churn rate analysis

4. **age** - Code age and stability
   - When files were last modified
   - Stability indicators

### Developer & Collaboration Metrics

5. **authors** - Contributor patterns
   - Number of contributors per file
   - Contribution distribution

6. **main-dev** - Main developers per file
   - Primary owner identification
   - Ownership by commits

7. **main-dev-by-revs** - Main developer by revision count
   - Alternative ownership metric
   - Based on revision count

8. **author-churn** - Individual developer contributions
   - Per-author churn metrics
   - Productivity insights

9. **communication** - Author communication patterns
   - Shared file modifications
   - Team collaboration analysis

10. **entity-ownership** - Detailed ownership per file
    - Percentage ownership
    - Multi-owner files

### Architectural & Quality Metrics

11. **coupling** - File dependencies
    - Files frequently changed together
    - Temporal coupling detection

12. **soc** - Sum of coupling per entity
    - Total coupling per file
    - Architectural complexity

13. **entity-effort** - Development effort distribution
    - Where development effort is spent
    - Resource allocation insights

14. **fragmentation** - Scattered changes analysis
    - Development focus
    - Context switching indicators

15. **refactoring-main-dev** - Refactoring expertise
    - Who refactors what
    - Code improvement patterns

---

## Output Structure

### Files Generated

```
results/<repo_name>/
├── git-log-codemaat.txt              # Extracted Git log
├── codemaat-all-analyses.json        # Combined results
├── codemaat-revisions.json           # Individual analysis files
├── codemaat-authors.json
├── codemaat-entity-churn.json
├── codemaat-coupling.json
├── codemaat-communication.json
├── codemaat-main-dev.json
├── codemaat-entity-effort.json
├── codemaat-abs-churn.json
├── codemaat-age.json
├── codemaat-author-churn.json
├── codemaat-entity-ownership.json
├── codemaat-fragmentation.json
├── codemaat-soc.json
├── codemaat-main-dev-by-revs.json
└── codemaat-refactoring-main-dev.json
```

### JSON Format

Each analysis file contains:

```json
{
  "repository_name": "myrepo",
  "tool": "codemaat-revisions",
  "analysis_type": "revisions",
  "analysis_timestamp": "2025-10-30T10:30:00",
  "success": true,
  "entries_count": 150,
  "data": [
    {
      "entity": "src/main.py",
      "n-revs": 45
    },
    ...
  ]
}
```

---

## Use Cases

### Identifying Hotspots

Hotspots are files that change frequently and may need refactoring:

```bash
# Run analysis
python codemaat_analyzer.py --repo /path/to/repo

# Check: codemaat-revisions.json for high n-revs
# Check: codemaat-entity-churn.json for high churn
```

### Understanding Ownership

Find who owns which parts of the codebase:

```bash
# Check: codemaat-main-dev.json
# Check: codemaat-entity-ownership.json
```

### Detecting Coupling

Find files that change together (architectural dependencies):

```bash
# Check: codemaat-coupling.json
# High coupling = files often changed together
```

### Team Communication Analysis

Understand team collaboration patterns:

```bash
# Check: codemaat-communication.json
# Shows which developers work on same files
```

### Code Stability Analysis

Find stable vs. unstable areas:

```bash
# Check: codemaat-age.json (old = stable)
# Check: codemaat-fragmentation.json (high = unstable)
```

---

## Command-Line Options

```bash
python codemaat_analyzer.py [OPTIONS]

Required:
  --repo PATH          Path to Git repository

Optional:
  --output PATH        Output directory (default: results/<repo_name>)
  --jar PATH           Path to cm.jar (auto-detected from tools/)
  --java PATH          Path to Java executable (default: 'java' from PATH)
  --sequential         Run analyses sequentially (default: parallel)
  --workers N          Number of parallel workers (default: 5)
  --verbose            Enable verbose logging
  -h, --help           Show help message
```

---

## Examples

### Basic Analysis

```bash
python codemaat_analyzer.py --repo /home/user/projects/myapp
```

Output:
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
   Repository: myapp

📋 Extracting Git log in CodeMaat format...
✅ Git log extracted:
   File: results/myapp/git-log-codemaat.txt
   Lines: 12,543
   Size: 1.2 MB

🔄 Running 15 CodeMaat analyses...
   Mode: Parallel

🚀 Running revisions analysis...
🚀 Running authors analysis...
...
✅ revisions: 234 entries
✅ authors: 189 entries
...

📊 Analysis Summary:
   Total: 15
   Successful: 15
   Failed: 0

💾 Saving results...
✅ Combined results: codemaat-all-analyses.json
   ✅ revisions: codemaat-revisions.json
   ✅ authors: codemaat-authors.json
   ...

📁 All results saved to: results/myapp

============================================================
✅ CodeMaat Analysis Complete!
============================================================
```

### Custom Output with Sequential Mode

```bash
python codemaat_analyzer.py \
  --repo C:\repos\myapp \
  --output C:\analysis-results \
  --sequential
```

### With Custom JAR Location

```bash
python codemaat_analyzer.py \
  --repo /path/to/repo \
  --jar /custom/path/code-maat.jar
```

### With Custom Java Path

```bash
# Linux/Mac - Use specific Java version
python codemaat_analyzer.py \
  --repo /path/to/repo \
  --java /usr/lib/jvm/java-11/bin/java

# Windows - Java not in PATH
python codemaat_analyzer.py \
  --repo C:\repos\myapp \
  --java "C:\Program Files\Java\jdk-11\bin\java.exe"
```

### Complete Custom Setup

```bash
# Specify everything
python codemaat_analyzer.py \
  --repo /path/to/repo \
  --output /custom/output \
  --jar /path/to/cm.jar \
  --java /path/to/java \
  --workers 3 \
  --verbose
```

---

## Troubleshooting

### "Java Runtime Environment not found"

**Problem:** Java not installed or not in PATH

**Solution:**
```bash
# Check Java
java -version

# If not found, install:
# Windows: Download from Oracle
# Mac: brew install openjdk
# Linux: sudo apt-get install default-jre

# Or specify Java path directly:
python codemaat_analyzer.py \
  --repo /path/to/repo \
  --java /path/to/java
```

### "CodeMaat JAR not found"

**Problem:** cm.jar file missing

**Solution:**
1. Ensure `tools/cm.jar` exists
2. Or specify with `--jar` option
3. Or download from: https://github.com/adamtornhill/code-maat/releases

### "Not a Git repository"

**Problem:** Target directory is not a Git repository

**Solution:**
```bash
# Ensure .git directory exists
ls -la /path/to/repo/.git

# Clone the repository first if needed
git clone <url> /path/to/repo
```

### "Analysis timed out"

**Problem:** Large repository causing timeout (> 5 minutes per analysis)

**Solution:**
- Analyses have 5-minute timeout each
- Use `--sequential` for very large repos
- Consider analyzing a subset of history

### Out of Memory

**Problem:** Java runs out of memory on large repositories

**Solution:**
```bash
# Increase Java heap size
export JAVA_OPTS="-Xmx4g"
python codemaat_analyzer.py --repo /path/to/repo
```

---

## Integration Examples

### CI/CD Pipeline

```yaml
# GitLab CI
analyze:
  script:
    - python codemaat_analyzer.py --repo $CI_PROJECT_DIR
  artifacts:
    paths:
      - results/
```

### Batch Processing

```bash
#!/bin/bash
# Analyze multiple repositories

for repo in /repos/*; do
  echo "Analyzing $repo..."
  python codemaat_analyzer.py --repo "$repo"
done
```

### Python Integration

```python
from pathlib import Path
from codemaat_analyzer import CodeMaatAnalyzer

# Create analyzer with default settings
analyzer = CodeMaatAnalyzer(
    repo_path=Path("/path/to/repo"),
    output_dir=Path("results/myrepo")
)

# Or with custom Java and JAR paths
analyzer = CodeMaatAnalyzer(
    repo_path=Path("/path/to/repo"),
    output_dir=Path("results/myrepo"),
    jar_path=Path("/custom/cm.jar"),
    java_path="/usr/lib/jvm/java-11/bin/java"
)

# Run analysis
results = analyzer.analyze(parallel=True)

# Access results
for analysis_type, result in results.items():
    if result["success"]:
        print(f"{analysis_type}: {result['entries_count']} entries")
```

---

## Performance

### Parallel Mode (Default)
- Runs up to 5 analyses simultaneously
- Fastest option for most repositories
- Recommended for normal use

### Sequential Mode
- Runs one analysis at a time
- Slower but uses less memory
- Better for very large repositories or limited resources

### Typical Analysis Times

| Repository Size | Commits | Parallel | Sequential |
|-----------------|---------|----------|------------|
| Small           | < 1,000 | 10-30s   | 30-60s     |
| Medium          | 1K-10K  | 30-90s   | 2-5 min    |
| Large           | 10K-50K | 1-3 min  | 5-15 min   |
| Very Large      | > 50K   | 3-10 min | 15-60 min  |

---

## Further Reading

- **CodeMaat Documentation:** https://github.com/adamtornhill/code-maat
- **Your Code as a Crime Scene (Book):** By Adam Tornhill
- **Software Design X-Rays (Book):** By Adam Tornhill

---

## Credits

- **CodeMaat:** https://github.com/adamtornhill/code-maat
- **Author:** Adam Tornhill
- **License:** GNU GPL v3.0

