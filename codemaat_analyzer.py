#!/usr/bin/env python3
"""
CodeMaat Evolution Analysis - Standalone
Extracts Git logs in CodeMaat format and runs all possible CodeMaat analyses.

CodeMaat provides 15+ analysis types for code evolution insights:
- Code churn, hotspots, coupling
- Author patterns, communication
- Code age, ownership, fragmentation
"""

import argparse
import json
import logging
import os
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed


# ============================================================================
# CONFIGURATION - Edit these paths to match your environment
# ============================================================================

# Default paths (None = auto-detect)
# You can set these directly instead of using command-line arguments

DEFAULT_REPO_PATH = None              # Path to Git repository (e.g., Path("/path/to/repo"))
DEFAULT_OUTPUT_DIR = None             # Output directory (e.g., Path("/custom/output"))
DEFAULT_JAR_PATH = None               # Path to cm.jar (e.g., Path("/path/to/cm.jar"))
DEFAULT_JAVA_PATH = None              # Path to Java executable (e.g., "/usr/lib/jvm/java-11/bin/java")
DEFAULT_GIT_PATH = None               # Path to Git executable (e.g., "/usr/bin/git")
# Windows Example:
DEFAULT_REPO_PATH = Path(r"C:\repos\myproject")
DEFAULT_OUTPUT_DIR = Path(r"C:\analysis-results")
DEFAULT_JAR_PATH = Path(r"C:\Tools\codemaat\cm.jar")
DEFAULT_JAVA_PATH = r"C:\Program Files\Java\jdk-11\bin\java.exe"
DEFAULT_GIT_PATH = r"C:\Program Files\Git\bin\git.exe"


# Analysis settings
DEFAULT_PARALLEL = True               # Run analyses in parallel (True) or sequential (False)
DEFAULT_MAX_WORKERS = 5               # Number of parallel workers

# Logging
DEFAULT_VERBOSE = False               # Enable verbose logging

# ============================================================================
# END CONFIGURATION
# ============================================================================


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("codemaat-analyzer")


class CodeMaatAnalyzer:
    """
    Comprehensive CodeMaat analyzer for code evolution insights.
    Runs all 15+ analysis types and generates detailed JSON reports.
    """
    
    # All available CodeMaat analysis types
    ANALYSIS_TYPES = [
        ("revisions", "Code evolution - how files change over time"),
        ("authors", "Author analysis - contributor patterns"),
        ("entity-churn", "Entity churn - frequently changing areas"),
        ("coupling", "Code coupling - file dependencies"),
        ("communication", "Communication patterns between authors"),
        ("main-dev", "Main developers for each file"),
        ("entity-effort", "Development effort distribution"),
        ("abs-churn", "Absolute churn metrics"),
        ("age", "Code age - stability analysis"),
        ("author-churn", "Author churn - individual developer contributions"),
        ("entity-ownership", "Entity ownership - detailed ownership per file"),
        ("fragmentation", "Code fragmentation - scattered changes analysis"),
        ("soc", "Sum of coupling - total coupling per entity"),
        ("main-dev-by-revs", "Main developer by revision count"),
        ("refactoring-main-dev", "Refactoring expertise mapping"),
    ]
    
    def __init__(self, repo_path: Path, output_dir: Path, jar_path: Optional[Path] = None, 
                 java_path: Optional[str] = None, git_path: Optional[str] = None):
        """
        Initialize CodeMaat analyzer.
        
        Args:
            repo_path: Path to Git repository
            output_dir: Directory for output JSON files
            jar_path: Path to cm.jar (auto-detected if not provided)
            java_path: Path to Java executable (auto-detected if not provided)
            git_path: Path to Git executable (auto-detected if not provided)
        """
        self.repo_path = repo_path
        self.output_dir = output_dir
        self.jar_path = jar_path or self._find_codemaat_jar()
        self.java_path = java_path or os.getenv('CODEMAAT_JAVA_PATH', 'java')
        self.git_path = git_path or os.getenv('CODEMAAT_GIT_PATH', 'git')
        self.git_log_file = None
        
        # Validate requirements
        self._validate_requirements()
    
    def _find_codemaat_jar(self) -> Path:
        """Find CodeMaat JAR file."""
        # Check environment variable first
        if env_jar := os.getenv('CODEMAAT_JAR_PATH'):
            env_jar_path = Path(env_jar)
            if env_jar_path.exists():
                return env_jar_path
            else:
                logger.warning(f"CODEMAAT_JAR_PATH set but file not found: {env_jar}")
        
        # Check in tools directory
        script_dir = Path(__file__).parent
        jar_locations = [
            script_dir / "tools" / "cm.jar",
            script_dir / "cm.jar",
            Path.cwd() / "tools" / "cm.jar",
        ]
        
        for jar_path in jar_locations:
            if jar_path.exists():
                return jar_path
        
        raise FileNotFoundError(
            "CodeMaat JAR file (cm.jar) not found. "
            "Download from: https://github.com/adamtornhill/code-maat/releases "
            "Or set CODEMAAT_JAR_PATH environment variable."
        )
    
    def _validate_requirements(self):
        """Validate that all requirements are met."""
        # Check Java
        if not self._check_java():
            raise RuntimeError(
                "Java Runtime Environment (JRE) not found. "
                "Download from: https://www.oracle.com/java/technologies/downloads/"
            )
        
        # Check Git
        if not self._check_git():
            raise RuntimeError("Git not found in system PATH")
        
        # Check repository
        if not (self.repo_path / ".git").exists():
            raise RuntimeError(f"Not a Git repository: {self.repo_path}")
        
        # Check CodeMaat JAR
        if not self.jar_path.exists():
            raise RuntimeError(f"CodeMaat JAR not found: {self.jar_path}")
        
        logger.info(f"✅ All requirements met")
        logger.info(f"   Java: {self.java_path}")
        logger.info(f"   Git: {self.git_path}")
        logger.info(f"   CodeMaat: {self.jar_path}")
        logger.info(f"   Repository: {self.repo_path.name}")
    
    def _check_java(self) -> bool:
        """Check if Java is available."""
        try:
            result = subprocess.run(
                [self.java_path, "-version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                # Extract Java version info for logging
                version_info = result.stderr.split('\n')[0] if result.stderr else "Unknown version"
                logger.info(f"   Java: {version_info}")
                return True
            return False
        except FileNotFoundError:
            logger.error(f"   Java executable not found: {self.java_path}")
            return False
        except Exception as e:
            logger.error(f"   Java check failed: {e}")
            return False
    
    def _check_git(self) -> bool:
        """Check if Git is available."""
        try:
            result = subprocess.run(
                [self.git_path, "--version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                version_info = result.stdout.strip()
                logger.info(f"   Git: {version_info}")
                return True
            return False
        except FileNotFoundError:
            logger.error(f"   Git executable not found: {self.git_path}")
            return False
        except Exception as e:
            logger.error(f"   Git check failed: {e}")
            return False
    
    def extract_git_log(self) -> Path:
        """
        Extract Git log in CodeMaat format.
        
        Format: --hash--date--author
        With: --all --numstat --date=short --no-renames
        
        Returns:
            Path to the generated git log file
        """
        logger.info(f"📋 Extracting Git log in CodeMaat format...")
        
        # Create output file
        log_file = self.output_dir / "git-log-codemaat.txt"
        
        try:
            # Git log command for CodeMaat format
            cmd = [
                self.git_path, "-C", str(self.repo_path),
                "log", "--all", "--numstat", "--date=short",
                "--pretty=format:--%h--%ad--%aN",
                "--no-renames"
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode != 0:
                raise RuntimeError(f"Git log extraction failed: {result.stderr}")
            
            # Write to file
            log_file.write_text(result.stdout, encoding='utf-8')
            
            # Get stats
            lines = len(result.stdout.splitlines())
            size_kb = log_file.stat().st_size / 1024
            
            logger.info(f"✅ Git log extracted:")
            logger.info(f"   File: {log_file}")
            logger.info(f"   Lines: {lines:,}")
            logger.info(f"   Size: {size_kb:.2f} KB")
            
            self.git_log_file = log_file
            return log_file
            
        except subprocess.TimeoutExpired:
            raise RuntimeError("Git log extraction timed out (> 2 minutes)")
        except Exception as e:
            raise RuntimeError(f"Git log extraction failed: {e}")
    
    def run_analysis(self, analysis_type: str) -> Tuple[str, Dict[str, Any]]:
        """
        Run a single CodeMaat analysis.
        
        Args:
            analysis_type: Type of analysis to run
            
        Returns:
            Tuple of (analysis_type, results_dict)
        """
        logger.info(f"🚀 Running {analysis_type} analysis...")
        
        try:
            # Run CodeMaat
            cmd = [
                self.java_path, "-jar", str(self.jar_path),
                "-l", str(self.git_log_file),
                "-c", "git2",  # Git log format version 2
                "-a", analysis_type
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode != 0:
                logger.warning(f"⚠️  {analysis_type} analysis failed: {result.stderr}")
                return (analysis_type, {
                    "success": False,
                    "error": result.stderr.strip()
                })
            
            # Parse CSV output
            parsed_data = self._parse_csv_output(result.stdout)
            
            logger.info(f"✅ {analysis_type}: {len(parsed_data)} entries")
            
            return (analysis_type, {
                "success": True,
                "analysis_type": analysis_type,
                "entries_count": len(parsed_data),
                "data": parsed_data
            })
            
        except subprocess.TimeoutExpired:
            logger.warning(f"⚠️  {analysis_type} timed out")
            return (analysis_type, {
                "success": False,
                "error": "Analysis timed out (> 5 minutes)"
            })
        except Exception as e:
            logger.warning(f"⚠️  {analysis_type} failed: {e}")
            return (analysis_type, {
                "success": False,
                "error": str(e)
            })
    
    def _parse_csv_output(self, csv_output: str) -> List[Dict[str, Any]]:
        """Parse CSV output from CodeMaat."""
        try:
            lines = csv_output.strip().split('\n')
            if len(lines) < 2:
                return []
            
            # Get headers
            headers = [h.strip() for h in lines[0].split(',')]
            
            # Parse data rows
            results = []
            for line in lines[1:]:
                if line.strip():
                    # Split by comma, but handle quoted values
                    values = []
                    in_quotes = False
                    current_value = ""
                    
                    for char in line:
                        if char == '"':
                            in_quotes = not in_quotes
                        elif char == ',' and not in_quotes:
                            values.append(current_value.strip())
                            current_value = ""
                        else:
                            current_value += char
                    
                    # Add last value
                    if current_value:
                        values.append(current_value.strip())
                    
                    # Create row dict
                    if len(values) == len(headers):
                        row_dict = {}
                        for header, value in zip(headers, values):
                            # Try to convert to number
                            try:
                                if '.' in value:
                                    row_dict[header] = float(value)
                                else:
                                    row_dict[header] = int(value)
                            except ValueError:
                                row_dict[header] = value
                        results.append(row_dict)
            
            return results
            
        except Exception as e:
            logger.warning(f"CSV parsing error: {e}")
            return []
    
    def run_all_analyses(self, parallel: bool = True, max_workers: int = 5) -> Dict[str, Any]:
        """
        Run all CodeMaat analyses.
        
        Args:
            parallel: Run analyses in parallel (faster)
            max_workers: Number of parallel workers
            
        Returns:
            Dictionary with all analysis results
        """
        logger.info(f"🔄 Running {len(self.ANALYSIS_TYPES)} CodeMaat analyses...")
        logger.info(f"   Mode: {'Parallel' if parallel else 'Sequential'}")
        
        all_results = {}
        successful = 0
        failed = 0
        
        if parallel:
            # Run in parallel
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {
                    executor.submit(self.run_analysis, analysis_type): analysis_type
                    for analysis_type, _ in self.ANALYSIS_TYPES
                }
                
                for future in as_completed(futures):
                    analysis_type, result = future.result()
                    all_results[analysis_type] = result
                    
                    if result.get("success"):
                        successful += 1
                    else:
                        failed += 1
        else:
            # Run sequentially
            for analysis_type, _ in self.ANALYSIS_TYPES:
                analysis_type, result = self.run_analysis(analysis_type)
                all_results[analysis_type] = result
                
                if result.get("success"):
                    successful += 1
                else:
                    failed += 1
        
        logger.info(f"")
        logger.info(f"📊 Analysis Summary:")
        logger.info(f"   Total: {len(self.ANALYSIS_TYPES)}")
        logger.info(f"   Successful: {successful}")
        logger.info(f"   Failed: {failed}")
        
        return all_results
    
    def save_results(self, results: Dict[str, Any], save_individual: bool = True):
        """
        Save analysis results to JSON files.
        
        Args:
            results: Analysis results dictionary
            save_individual: Save each analysis type to separate file
        """
        logger.info(f"💾 Saving results...")
        
        # Prepare main results file
        main_results = {
            "repository_name": self.repo_path.name,
            "repository_path": str(self.repo_path),
            "tool": "codemaat-evolution-analysis",
            "analysis_timestamp": datetime.now().isoformat(),
            "git_log_file": str(self.git_log_file) if self.git_log_file else None,
            "analyses_run": len(results),
            "analyses_successful": sum(1 for r in results.values() if r.get("success")),
            "analyses": results
        }
        
        # Save combined results
        combined_file = self.output_dir / "codemaat-all-analyses.json"
        with open(combined_file, 'w', encoding='utf-8') as f:
            json.dump(main_results, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Combined results: {combined_file}")
        
        # Save individual analysis files
        if save_individual:
            for analysis_type, result in results.items():
                if result.get("success"):
                    individual_file = self.output_dir / f"codemaat-{analysis_type}.json"
                    
                    individual_data = {
                        "repository_name": self.repo_path.name,
                        "tool": f"codemaat-{analysis_type}",
                        "analysis_type": analysis_type,
                        "analysis_timestamp": datetime.now().isoformat(),
                        "success": True,
                        "entries_count": result.get("entries_count", 0),
                        "data": result.get("data", [])
                    }
                    
                    with open(individual_file, 'w', encoding='utf-8') as f:
                        json.dump(individual_data, f, indent=2, ensure_ascii=False)
                    
                    logger.info(f"   ✅ {analysis_type}: {individual_file.name}")
        
        logger.info(f"")
        logger.info(f"📁 All results saved to: {self.output_dir}")
    
    def analyze(self, parallel: bool = True) -> Dict[str, Any]:
        """
        Run complete analysis workflow.
        
        Args:
            parallel: Run analyses in parallel
            
        Returns:
            Analysis results dictionary
        """
        logger.info(f"")
        logger.info(f"{'='*60}")
        logger.info(f"CodeMaat Evolution Analysis")
        logger.info(f"{'='*60}")
        logger.info(f"Repository: {self.repo_path.name}")
        logger.info(f"Output: {self.output_dir}")
        logger.info(f"{'='*60}")
        logger.info(f"")
        
        try:
            # Step 1: Extract Git log
            self.extract_git_log()
            logger.info(f"")
            
            # Step 2: Run all analyses
            results = self.run_all_analyses(parallel=parallel)
            logger.info(f"")
            
            # Step 3: Save results
            self.save_results(results, save_individual=True)
            
            logger.info(f"")
            logger.info(f"{'='*60}")
            logger.info(f"✅ CodeMaat Analysis Complete!")
            logger.info(f"{'='*60}")
            
            return results
            
        except Exception as e:
            logger.error(f"")
            logger.error(f"{'='*60}")
            logger.error(f"❌ Analysis Failed: {e}")
            logger.error(f"{'='*60}")
            raise


def main():
    """Main entry point."""
    # Apply verbose logging from config if set
    if DEFAULT_VERBOSE:
        logger.setLevel(logging.DEBUG)
    
    parser = argparse.ArgumentParser(
        description="CodeMaat Evolution Analysis - Extract logs and run all analyses",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Available Analysis Types:
  - revisions: Code evolution over time
  - authors: Contributor patterns
  - entity-churn: Frequently changing areas
  - coupling: File dependencies
  - communication: Author communication patterns
  - main-dev: Main developers per file
  - entity-effort: Development effort distribution
  - abs-churn: Absolute churn metrics
  - age: Code age and stability
  - author-churn: Individual developer contributions
  - entity-ownership: Detailed ownership per file
  - fragmentation: Scattered changes analysis
  - soc: Sum of coupling per entity
  - main-dev-by-revs: Main developer by revision count
  - refactoring-main-dev: Refactoring expertise

Example Usage:
  python codemaat_analyzer.py --repo /path/to/repo
  python codemaat_analyzer.py --repo C:\\repos\\myapp --output C:\\analysis
  python codemaat_analyzer.py --repo /path/to/repo --sequential
  python codemaat_analyzer.py --repo /path/to/repo --java /usr/lib/jvm/java-11/bin/java
  python codemaat_analyzer.py --repo /path/to/repo --jar /custom/cm.jar --java C:\\Java\\bin\\java.exe

Environment Variables:
  CODEMAAT_JAR_PATH      Path to cm.jar
  CODEMAAT_JAVA_PATH     Path to Java executable
  CODEMAAT_GIT_PATH      Path to Git executable
  CODEMAAT_OUTPUT_DIR    Default output directory
        """
    )
    
    parser.add_argument(
        "--repo",
        type=Path,
        required=False if DEFAULT_REPO_PATH else True,
        default=DEFAULT_REPO_PATH,
        help="Path to Git repository (can be set in script config)"
    )
    
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Output directory for results (can be set in script config, default: results/<repo_name>)"
    )
    
    parser.add_argument(
        "--jar",
        type=Path,
        default=DEFAULT_JAR_PATH,
        help="Path to cm.jar (can be set in script config, auto-detected if not provided)"
    )
    
    parser.add_argument(
        "--java",
        type=str,
        default=DEFAULT_JAVA_PATH,
        help="Path to Java executable (can be set in script config, default: 'java' from PATH or CODEMAAT_JAVA_PATH env var)"
    )
    
    parser.add_argument(
        "--git",
        type=str,
        default=DEFAULT_GIT_PATH,
        help="Path to Git executable (can be set in script config, default: 'git' from PATH or CODEMAAT_GIT_PATH env var)"
    )
    
    parser.add_argument(
        "--sequential",
        action="store_true",
        default=not DEFAULT_PARALLEL,
        help="Run analyses sequentially instead of parallel (can be set in script config)"
    )
    
    parser.add_argument(
        "--workers",
        type=int,
        default=DEFAULT_MAX_WORKERS,
        help=f"Number of parallel workers (can be set in script config, default: {DEFAULT_MAX_WORKERS})"
    )
    
    parser.add_argument(
        "--verbose",
        action="store_true",
        default=DEFAULT_VERBOSE,
        help="Enable verbose logging (can be set in script config)"
    )
    
    args = parser.parse_args()
    
    # Validate required arguments
    if not args.repo:
        parser.error("--repo is required (or set DEFAULT_REPO_PATH in script config)")
    
    # Configure logging (CLI overrides config)
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    # Determine output directory (priority: CLI arg > env var > default)
    if args.output:
        output_dir = args.output
    elif env_output := os.getenv('CODEMAAT_OUTPUT_DIR'):
        output_dir = Path(env_output) / args.repo.name
    else:
        output_dir = Path("results") / args.repo.name
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Create analyzer
        analyzer = CodeMaatAnalyzer(
            repo_path=args.repo,
            output_dir=output_dir,
            jar_path=args.jar,
            java_path=args.java,
            git_path=args.git
        )
        
        # Run analysis
        analyzer.analyze(parallel=not args.sequential)
        
        return 0
        
    except KeyboardInterrupt:
        logger.info("\n⚠️  Analysis interrupted by user")
        return 130
    except Exception as e:
        logger.error(f"\n❌ Fatal error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())

