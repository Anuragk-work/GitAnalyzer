"""
CodeMaat Analyzer - Configuration Example

Copy the configuration section from codemaat_analyzer.py and customize these values.
Then you can run the script without command-line arguments!
"""

from pathlib import Path

# ============================================================================
# CONFIGURATION EXAMPLE - Copy this to codemaat_analyzer.py
# ============================================================================

# Windows Example:
DEFAULT_REPO_PATH = Path(r"C:\repos\myproject")
DEFAULT_OUTPUT_DIR = Path(r"C:\analysis-results")
DEFAULT_JAR_PATH = Path(r"C:\Tools\codemaat\cm.jar")
DEFAULT_JAVA_PATH = r"C:\Program Files\Java\jdk-11\bin\java.exe"
DEFAULT_GIT_PATH = r"C:\Program Files\Git\bin\git.exe"

# Linux/Mac Example:
# DEFAULT_REPO_PATH = Path("/home/user/projects/myproject")
# DEFAULT_OUTPUT_DIR = Path("/home/user/analysis-results")
# DEFAULT_JAR_PATH = Path("/opt/codemaat/cm.jar")
# DEFAULT_JAVA_PATH = "/usr/lib/jvm/java-11/bin/java"
# DEFAULT_GIT_PATH = "/usr/bin/git"

# Auto-detect Example (recommended):
# DEFAULT_REPO_PATH = None              # Must be provided via --repo
# DEFAULT_OUTPUT_DIR = None             # Auto: results/<repo_name>/
# DEFAULT_JAR_PATH = None               # Auto: tools/cm.jar
# DEFAULT_JAVA_PATH = None              # Auto: 'java' from PATH
# DEFAULT_GIT_PATH = None               # Auto: 'git' from PATH

# Analysis settings
DEFAULT_PARALLEL = True               # Run in parallel (faster)
DEFAULT_MAX_WORKERS = 5               # Number of parallel analyses

# Logging
DEFAULT_VERBOSE = False               # Set to True for detailed logs

# ============================================================================
# USAGE EXAMPLES
# ============================================================================

"""
After setting these values in codemaat_analyzer.py:

1. Simple run (uses config values):
   python codemaat_analyzer.py

2. Override repo only:
   python codemaat_analyzer.py --repo /different/repo

3. Override everything:
   python codemaat_analyzer.py --repo /path/to/repo --java /path/to/java

Priority order:
  1. Command-line arguments (highest)
  2. Environment variables
  3. Script configuration (DEFAULT_* values)
  4. Auto-detection (lowest)
"""

