#!/usr/bin/env python3
"""
Script to analyze GitLab repositories using multiple analysis tools:
- Git Commit History: Extract commit data (last 2 years)
- SCC: Source code counter (tech stack analysis)
- Lizard: Code complexity analysis
- Trivy: Vulnerability scanning
- CodeMaat: Code evolution analysis (last 2 years)
- Hotspot Analysis: Identify high-risk code (high complexity + high change frequency)

Reads a list of repository URLs from a text file, clones each repository,
runs analyses, and stores results in JSON/CSV format.
"""

import os
import sys
import json
import csv
import subprocess
import shutil
import tempfile
import argparse
import time
from datetime import datetime
from io import StringIO

# ============================================================================
# CONFIGURATION
# ============================================================================
# Path to SCC executable - modify this to point to your scc installation
# Examples:
#   - System PATH: 'scc'
#   - Absolute path: '/usr/local/bin/scc'
#   - Relative path: './tools/scc'
#   - Windows: 'C:\\tools\\scc.exe' or 'scc.exe'
SCC_PATH = 'scc'  # Default: use 'scc' from system PATH

# Path to Trivy executable - modify this to point to your trivy installation
# Examples:
#   - System PATH: 'trivy'
#   - Absolute path: '/usr/local/bin/trivy'
#   - Relative path: './tools/trivy'
#   - Windows: 'C:\\tools\\trivy.exe' or 'trivy.exe'
TRIVY_PATH = 'trivy'  # Default: use 'trivy' from system PATH

# Path to Trivy cache directory for offline usage (optional)
# If set, Trivy will use this cache and skip database updates (offline mode)
# Set to None to use online mode (downloads latest vulnerability database)
# Examples:
#   - Relative path: './tools/trivy-cache'
#   - Absolute path: '/path/to/trivy-cache'
#   - Windows: 'C:\\tools\\trivy-cache'
TRIVY_CACHE_DIR = './tools/trivy-cache'  # Default: use local cache in tools directory

# Path to CodeMaat JAR file - for code evolution analysis
# Examples:
#   - Relative path: './tools/cm.jar'
#   - Absolute path: '/usr/local/bin/cm.jar'
#   - Windows: 'C:\\tools\\cm.jar'
CODEMAAT_JAR_PATH = './tools/cm.jar'  # Default: use cm.jar in tools directory
# ============================================================================


def extract_repo_name(repo_url):
    """Extract repository name from GitLab URL"""
    # Remove .git suffix if present
    url = repo_url.strip().rstrip('/')
    if url.endswith('.git'):
        url = url[:-4]
    
    # Extract the last part of the path as repo name
    repo_name = url.split('/')[-1]
    return repo_name


def run_command(command, cwd=None, capture_output=True):
    """Run a shell command and return the result"""
    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=cwd,
            capture_output=capture_output,
            text=True,
            check=True
        )
        return result.stdout if capture_output else None
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {command}")
        print(f"Error: {e.stderr if capture_output else e}")
        return None


def check_scc_installed(scc_path):
    """Check if scc command is available"""
    # Try to run scc --version to verify it's accessible
    try:
        result = subprocess.run(
            [scc_path, '--version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
        return False


def clone_repository(repo_url, clone_dir):
    """Clone a GitLab repository with Windows compatibility"""
    print(f"  Cloning repository: {repo_url}")
    try:
        # Add Windows-specific configurations to handle long paths and checkout issues
        git_config = [
            "-c", "core.longpaths=true",           # Handle long file paths on Windows
            "-c", "core.protectNTFS=false",        # Allow special characters
            "-c", "core.filemode=false",           # Ignore file permissions
        ]
        
        # Build the git clone command with configurations
        cmd = ["git"] + git_config + [
            "clone",
            "--single-branch",                     # Only main/default branch
            repo_url,
            clone_dir
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
            timeout=600  # 10 minute timeout for full clone
        )
        return True, None
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr if e.stderr else str(e)
        # Check if checkout failed specifically
        if "checkout" in error_msg.lower() and "failed" in error_msg.lower():
            error_msg = f"Checkout failed (likely Windows path/permission issue): {error_msg}"
        return False, error_msg
    except subprocess.TimeoutExpired:
        return False, "Clone operation timed out"
    except Exception as e:
        return False, str(e)


def collect_commit_data(repo_path):
    """Collect git commit history data (last 2 years only)"""
    print(f"  Collecting commit history (last 2 years)...")
    try:
        # Git log command to extract commit data (last 2 years only)
        cmd = [
            "git", "-C", repo_path,
            "log", "--all",
            "--since=2.years",  # Only commits from last 2 years
            "--date=iso-strict",
            "--pretty=format:{\"hash\":\"%H\",\"author_name\":\"%an\",\"author_email\":\"%ae\",\"date\":\"%ad\",\"message\":\"%s\"}"
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120  # 2 minute timeout
        )
        
        if result.returncode != 0:
            print(f"  Warning: Failed to collect commit data: {result.stderr}")
            return None
        
        if not result.stdout.strip():
            print(f"  Warning: No commits found")
            return []
        
        # Parse each line as JSON and collect into array
        commits = []
        for line in result.stdout.strip().split('\n'):
            if line.strip():
                try:
                    commit = json.loads(line)
                    commits.append(commit)
                except json.JSONDecodeError as e:
                    print(f"  Warning: Failed to parse commit line: {e}")
                    continue
        
        print(f"  ✅ Collected {len(commits)} commits")
        return commits
        
    except subprocess.TimeoutExpired:
        print(f"  Warning: Commit collection timed out")
        return None
    except Exception as e:
        print(f"  Error collecting commit data: {e}")
        return None


def analyze_with_scc(repo_path, scc_path):
    """Run scc on the repository and return JSON output"""
    print(f"  Running SCC analysis...")
    # Run scc with JSON format output
    # Use shell=True to handle path with spaces or special characters
    result = run_command(f'"{scc_path}" --format json', cwd=repo_path)
    
    if result:
        try:
            return json.loads(result)
        except json.JSONDecodeError as e:
            print(f"  Error parsing SCC output: {e}")
            return None
    return None


def analyze_with_lizard(repo_path):
    """Run Lizard code complexity analysis using Python library"""
    print(f"  Running Lizard complexity analysis...")
    try:
        # Import lizard library
        import lizard
        
        # Run lizard analysis on the repository
        analysis_result = lizard.analyze(
            paths=[repo_path],
            exclude_pattern=".*/(test|tests|node_modules|venv|__pycache__|.git)/.*",
            working_threads=1
        )
        
        # Convert results to dictionary format
        functions_list = []
        for item in analysis_result:
            if hasattr(item, 'function_list'):
                for func in item.function_list:
                    functions_list.append({
                        'name': func.name,
                        'long_name': func.long_name,
                        'file': item.filename,
                        'start_line': func.start_line,
                        'end_line': func.end_line,
                        'nloc': func.nloc,
                        'cyclomatic_complexity': func.cyclomatic_complexity,
                        'token_count': func.token_count,
                        'parameter_count': len(func.parameters) if hasattr(func, 'parameters') else 0,
                        'length': func.length,
                        'fan_in': func.fan_in if hasattr(func, 'fan_in') else 0,
                        'fan_out': func.fan_out if hasattr(func, 'fan_out') else 0,
                        'general_fan_out': func.general_fan_out if hasattr(func, 'general_fan_out') else 0,
                    })
        
        # Calculate summary statistics
        if functions_list:
            complexities = [f['cyclomatic_complexity'] for f in functions_list]
            summary = {
                'total_functions': len(functions_list),
                'average_complexity': round(sum(complexities) / len(complexities), 2),
                'max_complexity': max(complexities),
                'min_complexity': min(complexities),
                'complexity_distribution': {
                    'low': len([f for f in functions_list if f['cyclomatic_complexity'] <= 5]),
                    'medium': len([f for f in functions_list if 5 < f['cyclomatic_complexity'] <= 10]),
                    'high': len([f for f in functions_list if 10 < f['cyclomatic_complexity'] <= 20]),
                    'very_high': len([f for f in functions_list if f['cyclomatic_complexity'] > 20])
                },
                'total_nloc': sum(f['nloc'] for f in functions_list)
            }
        else:
            summary = {
                'total_functions': 0,
                'average_complexity': 0,
                'max_complexity': 0,
                'min_complexity': 0
            }
        
        return {
            'summary': summary,
            'functions': functions_list[:100]  # Limit to top 100 functions for file size
        }
        
    except ImportError:
        print(f"  Warning: Lizard library not installed. Skipping complexity analysis.")
        print(f"  Install with: pip install lizard")
        return None
    except Exception as e:
        print(f"  Error running Lizard analysis: {e}")
        return None


def analyze_with_trivy(repo_path, trivy_path='trivy', cache_dir=None):
    """Run Trivy vulnerability scanning"""
    print(f"  Running Trivy vulnerability scan...")
    try:
        # Check if trivy is available at the specified path
        # If trivy_path is a relative/absolute path, use it directly
        # If it's just 'trivy', try to find it in PATH
        if os.path.isfile(trivy_path):
            trivy_cmd = trivy_path
        else:
            trivy_cmd = shutil.which(trivy_path)
            if not trivy_cmd:
                print(f"  Warning: Trivy not found at: {trivy_path}")
                print(f"  Skipping vulnerability scan.")
                return None
        
        # Build trivy filesystem scan command
        cmd = [
            trivy_cmd, "fs",
            "--scanners", "vuln,secret,misconfig",
            "--format", "json",
            "--exit-code", "0",
            "--timeout", "10m",
            "--quiet"
        ]
        
        # Add offline cache support if cache directory is specified
        if cache_dir:
            if os.path.exists(cache_dir):
                cmd.extend(["--cache-dir", cache_dir])
                cmd.append("--skip-db-update")  # Don't try to update DB in offline mode
                print(f"  Using offline Trivy cache: {cache_dir}")
            else:
                print(f"  Warning: Trivy cache directory not found: {cache_dir}")
                print(f"  Continuing without offline cache (will attempt online DB update)")
        
        # Add target path
        cmd.append(repo_path)
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600  # 10 minute timeout
        )
        
        if result.returncode != 0:
            print(f"  Warning: Trivy scan returned errors: {result.stderr}")
            return None
        
        if not result.stdout.strip():
            return {'vulnerabilities': [], 'secrets': [], 'misconfigurations': []}
        
        # Parse JSON output
        trivy_data = json.loads(result.stdout)
        
        # Extract and summarize results
        vulnerabilities = []
        secrets = []
        misconfigs = []
        
        if 'Results' in trivy_data:
            for scan_result in trivy_data['Results']:
                # Vulnerabilities
                if 'Vulnerabilities' in scan_result and scan_result['Vulnerabilities']:
                    for vuln in scan_result['Vulnerabilities']:
                        vulnerabilities.append({
                            'id': vuln.get('VulnerabilityID'),
                            'package': vuln.get('PkgName'),
                            'installed_version': vuln.get('InstalledVersion'),
                            'fixed_version': vuln.get('FixedVersion'),
                            'severity': vuln.get('Severity'),
                            'title': vuln.get('Title', '')[:200]  # Truncate long titles
                        })
                
                # Secrets
                if 'Secrets' in scan_result and scan_result['Secrets']:
                    for secret in scan_result['Secrets']:
                        secrets.append({
                            'category': secret.get('Category'),
                            'severity': secret.get('Severity'),
                            'title': secret.get('Title'),
                            'match': secret.get('Match', '')[:100]  # Truncate
                        })
                
                # Misconfigurations
                if 'Misconfigurations' in scan_result and scan_result['Misconfigurations']:
                    for misconfig in scan_result['Misconfigurations']:
                        misconfigs.append({
                            'type': misconfig.get('Type'),
                            'id': misconfig.get('ID'),
                            'title': misconfig.get('Title'),
                            'severity': misconfig.get('Severity'),
                            'message': misconfig.get('Message', '')[:200]
                        })
        
        # Create summary
        severity_counts = {'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0, 'UNKNOWN': 0}
        for vuln in vulnerabilities:
            severity = vuln.get('severity', 'UNKNOWN')
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        return {
            'summary': {
                'total_vulnerabilities': len(vulnerabilities),
                'total_secrets': len(secrets),
                'total_misconfigurations': len(misconfigs),
                'severity_counts': severity_counts
            },
            'vulnerabilities': vulnerabilities[:50],  # Limit to 50 for file size
            'secrets': secrets[:20],
            'misconfigurations': misconfigs[:20]
        }
        
    except FileNotFoundError:
        print(f"  Warning: Trivy not found. Skipping vulnerability scan.")
        return None
    except subprocess.TimeoutExpired:
        print(f"  Warning: Trivy scan timed out.")
        return None
    except Exception as e:
        print(f"  Error running Trivy scan: {e}")
        return None


def analyze_with_codemaat(repo_path, repo_name, repo_results_dir, jar_path='./tools/cm.jar'):
    """Run CodeMaat evolution analysis (last 2 years) - All 15 analysis types
    
    Saves each analysis as a separate CSV file:
    - {repo}_cm_revisions.csv
    - {repo}_cm_authors.csv
    - etc.
    """
    print(f"  Running CodeMaat evolution analysis (15 types, last 2 years)...")
    
    try:
        # Check if CodeMaat JAR exists
        if not os.path.isfile(jar_path):
            print(f"  Warning: CodeMaat JAR not found at: {jar_path}")
            print(f"  Skipping CodeMaat analysis.")
            return None
        
        # Check if Java is available
        try:
            subprocess.run(["java", "-version"], capture_output=True, timeout=5)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            print(f"  Warning: Java not found. CodeMaat requires Java.")
            return None
        
        # Extract git log in CodeMaat format (last 2 years)
        print(f"  Extracting git log for CodeMaat...")
        log_cmd = [
            "git", "-C", repo_path,
            "log", "--all",
            "--since=2.years",  # Last 2 years only
            "--numstat",
            "--date=short",
            "--pretty=format:--%h--%ad--%aN",
            "--no-renames"
        ]
        
        log_result = subprocess.run(
            log_cmd,
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if log_result.returncode != 0 or not log_result.stdout.strip():
            print(f"  Warning: Failed to extract git log for CodeMaat")
            return None
        
        git_log = log_result.stdout
        
        # Run all available CodeMaat analyses
        analyses_to_run = [
            "revisions",              # Code evolution - how files change over time
            "authors",                # Author analysis - contributor patterns
            "entity-churn",           # Entity churn - frequently changing areas
            "coupling",               # Code coupling - file dependencies
            "communication",          # Communication patterns between authors
            "main-dev",               # Main developers for each file
            "entity-effort",          # Development effort distribution
            "abs-churn",              # Absolute churn metrics
            "age",                    # Code age - stability analysis
            "author-churn",           # Author churn - individual developer contributions
            "entity-ownership",       # Entity ownership - detailed ownership per file
            "fragmentation",          # Code fragmentation - scattered changes analysis
            "soc",                    # Sum of coupling - total coupling per entity
            "main-dev-by-revs",       # Main developer by revision count
            "refactoring-main-dev"    # Refactoring expertise mapping
        ]
        
        successful_analyses = 0
        failed_analyses = 0
        
        for analysis_type in analyses_to_run:
            try:
                # Run CodeMaat analysis
                cmd = [
                    "java", "-jar", jar_path,
                    "-c", "git2",
                    "-a", analysis_type
                ]
                
                result = subprocess.run(
                    cmd,
                    input=git_log,
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                
                if result.returncode == 0 and result.stdout.strip():
                    # Save CSV output directly to file
                    csv_filename = f"{repo_name}_cm_{analysis_type.replace('-', '_')}.csv"
                    csv_path = os.path.join(repo_results_dir, csv_filename)
                    
                    with open(csv_path, 'w', encoding='utf-8') as f:
                        f.write(result.stdout)
                    
                    # Count entries (lines - 1 for header)
                    entries_count = len(result.stdout.strip().split('\n')) - 1
                    print(f"  ✅ {analysis_type}: {entries_count} entries → {csv_filename}")
                    successful_analyses += 1
                else:
                    print(f"  ⚠️  {analysis_type}: No data or analysis failed")
                    failed_analyses += 1
                    
            except Exception as e:
                print(f"  ⚠️  {analysis_type}: {str(e)}")
                failed_analyses += 1
        
        # Return summary
        return {
            "successful": successful_analyses,
            "failed": failed_analyses,
            "total": len(analyses_to_run)
        }
        
    except Exception as e:
        print(f"  Error running CodeMaat analysis: {e}")
        return None


def analyze_hotspots(repo_name, repo_results_dir, complexity_data, codemaat_enabled):
    """
    Identify code hotspots by combining revisions (change frequency) and complexity.
    
    Hotspots = High change frequency + High complexity
    These are high-risk areas that need attention.
    """
    if not codemaat_enabled:
        return None
    
    print(f"  Analyzing code hotspots...")
    
    try:
        # 1. Load revisions data (change frequency from CodeMaat)
        revisions_file = os.path.join(repo_results_dir, f"{repo_name}_cm_revisions.csv")
        
        if not os.path.exists(revisions_file):
            print(f"  ⚠️  Revisions file not found, skipping hotspot analysis")
            return None
        
        revisions = {}
        with open(revisions_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            if len(lines) < 2:
                return None
            
            # Skip header
            for line in lines[1:]:
                line = line.strip()
                if line:
                    parts = line.split(',')
                    if len(parts) >= 2:
                        entity = parts[0].strip('"')
                        try:
                            n_revs = int(parts[1])
                            revisions[entity] = n_revs
                        except ValueError:
                            continue
        
        if not revisions:
            print(f"  ⚠️  No revision data found")
            return None
        
        # 2. Aggregate complexity by file from Lizard data
        if not complexity_data or not complexity_data.get('functions'):
            print(f"  ⚠️  No complexity data available")
            return None
        
        file_complexity = {}
        for func in complexity_data['functions']:
            file_path = func['file']
            complexity = func['cyclomatic_complexity']
            nloc = func['nloc']
            
            if file_path not in file_complexity:
                file_complexity[file_path] = {
                    'max_complexity': 0,
                    'total_complexity': 0,
                    'function_count': 0,
                    'total_nloc': 0
                }
            
            file_complexity[file_path]['function_count'] += 1
            file_complexity[file_path]['total_complexity'] += complexity
            file_complexity[file_path]['total_nloc'] += nloc
            file_complexity[file_path]['max_complexity'] = max(
                file_complexity[file_path]['max_complexity'], 
                complexity
            )
        
        # Calculate averages
        for file_path in file_complexity:
            file_complexity[file_path]['avg_complexity'] = round(
                file_complexity[file_path]['total_complexity'] / 
                file_complexity[file_path]['function_count'], 
                2
            )
        
        # 3. Combine revisions + complexity to find hotspots
        hotspots = []
        
        for file_path, revs in revisions.items():
            # Try to match file paths (CodeMaat may have different path format)
            matched_complexity = None
            
            # Direct match
            if file_path in file_complexity:
                matched_complexity = file_complexity[file_path]
            else:
                # Partial match (file ends with path or vice versa)
                for complex_file in file_complexity.keys():
                    if complex_file.endswith(file_path) or file_path.endswith(complex_file):
                        matched_complexity = file_complexity[complex_file]
                        break
            
            if matched_complexity:
                avg_complexity = matched_complexity['avg_complexity']
                max_complexity = matched_complexity['max_complexity']
                
                # Calculate hotspot score
                # Formula: (revisions * complexity) with normalization
                # Higher score = bigger hotspot/problem
                hotspot_score = round(
                    (revs / 10) * (avg_complexity / 5) * 10, 
                    2
                )
                
                # Risk level classification
                risk_level = 'LOW'
                if revs >= 50 and avg_complexity >= 15:
                    risk_level = 'CRITICAL'
                elif revs >= 50 and avg_complexity >= 8:
                    risk_level = 'HIGH'
                elif revs >= 30 and avg_complexity >= 8:
                    risk_level = 'HIGH'
                elif revs >= 20 or avg_complexity >= 10:
                    risk_level = 'MEDIUM'
                
                hotspots.append({
                    'file': file_path,
                    'revisions': revs,
                    'avg_complexity': avg_complexity,
                    'max_complexity': max_complexity,
                    'function_count': matched_complexity['function_count'],
                    'total_nloc': matched_complexity['total_nloc'],
                    'hotspot_score': hotspot_score,
                    'risk_level': risk_level
                })
        
        if not hotspots:
            print(f"  ⚠️  No hotspots identified")
            return None
        
        # Sort by hotspot score (highest first)
        hotspots.sort(key=lambda x: x['hotspot_score'], reverse=True)
        
        # Save to CSV
        csv_filename = f"{repo_name}_hotspots.csv"
        csv_path = os.path.join(repo_results_dir, csv_filename)
        
        with open(csv_path, 'w', encoding='utf-8', newline='') as f:
            if hotspots:
                fieldnames = ['file', 'risk_level', 'hotspot_score', 'revisions', 
                             'avg_complexity', 'max_complexity', 'function_count', 'total_nloc']
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(hotspots)
        
        # Count by risk level
        risk_counts = {'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
        for h in hotspots:
            risk_counts[h['risk_level']] += 1
        
        print(f"  ✅ Hotspots identified: {len(hotspots)} files")
        print(f"     🔴 CRITICAL: {risk_counts['CRITICAL']}, "
              f"🟠 HIGH: {risk_counts['HIGH']}, "
              f"🟡 MEDIUM: {risk_counts['MEDIUM']}, "
              f"🟢 LOW: {risk_counts['LOW']}")
        print(f"     Saved to: {csv_filename}")
        
        return {
            'total_hotspots': len(hotspots),
            'risk_counts': risk_counts,
            'top_5': hotspots[:5]
        }
        
    except Exception as e:
        print(f"  Error analyzing hotspots: {e}")
        return None


def save_results(data, output_path):
    """Save analysis results to JSON file"""
    try:
        # Create results directory if it doesn't exist
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"  Results saved to: {output_path}")
        return True
    except Exception as e:
        print(f"  Error saving results: {e}")
        return False


def log_access_error(repo_url, error_message, results_dir):
    """Log repository access errors to access_error.txt"""
    try:
        # Create results directory if it doesn't exist
        if not os.path.exists(results_dir):
            os.makedirs(results_dir, exist_ok=True)
        
        error_file = os.path.join(results_dir, 'access_error.txt')
        
        # Append error to file
        with open(error_file, 'a', encoding='utf-8') as f:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            f.write(f"{repo_url}\n")
            f.write(f"  Error: {error_message}\n")
            f.write(f"  Timestamp: {timestamp}\n")
            f.write("-" * 80 + "\n")
        
        print(f"  Access error logged to: {error_file}")
        return True
    except Exception as e:
        print(f"  Warning: Failed to log access error: {e}")
        return False


def process_repository(repo_url, results_dir, temp_base_dir, scc_path, trivy_path='trivy', trivy_cache_dir=None, codemaat_jar_path=None, run_lizard=True, run_trivy=False, run_codemaat=False):
    """Process a single repository: clone, analyze, and save results"""
    repo_name = extract_repo_name(repo_url)
    print(f"\nProcessing: {repo_name}")
    print(f"="*60)
    
    # Create a dedicated results directory for this repository
    repo_results_dir = os.path.join(results_dir, repo_name)
    os.makedirs(repo_results_dir, exist_ok=True)
    
    # Create a temporary directory for this specific repo
    temp_dir = tempfile.mkdtemp(dir=temp_base_dir, prefix=f"{repo_name}_")
    clone_path = os.path.join(temp_dir, repo_name)
    
    try:
        # Clone the repository
        clone_success, clone_error = clone_repository(repo_url, clone_path)
        if not clone_success:
            print(f"  ❌ Failed to clone repository: {repo_url}")
            print(f"  Error: {clone_error}")
            # Log to access_error.txt
            log_access_error(repo_url, clone_error, results_dir)
            return False
        
        analysis_results = {}
        
        # Collect commit history data
        commit_data = collect_commit_data(clone_path)
        if commit_data is not None:
            commit_results = {
                "repository_url": repo_url,
                "repository_name": repo_name,
                "total_commits": len(commit_data),
                "commits": commit_data
            }
            output_file = os.path.join(repo_results_dir, "commits.json")
            if save_results(commit_results, output_file):
                analysis_results['commits'] = True
        else:
            analysis_results['commits'] = False
        
        # Run SCC analysis (tech stack)
        scc_data = analyze_with_scc(clone_path, scc_path)
        if scc_data:
            scc_results = {
                "repository_url": repo_url,
                "repository_name": repo_name,
                "analysis_type": "techstack",
                "tool": "scc",
                "analysis": scc_data
            }
            output_file = os.path.join(repo_results_dir, "techStack.json")
            if save_results(scc_results, output_file):
                analysis_results['techstack'] = True
        else:
            print(f"  ⚠️  SCC analysis failed")
            analysis_results['techstack'] = False
        
        # Run Lizard analysis (code complexity)
        lizard_data = None
        if run_lizard:
            lizard_data = analyze_with_lizard(clone_path)
            if lizard_data:
                lizard_results = {
                    "repository_url": repo_url,
                    "repository_name": repo_name,
                    "analysis_type": "complexity",
                    "tool": "lizard",
                    "analysis": lizard_data
                }
                output_file = os.path.join(repo_results_dir, "complexity.json")
                if save_results(lizard_results, output_file):
                    analysis_results['complexity'] = True
            else:
                analysis_results['complexity'] = False
        
        # Run Trivy analysis (vulnerabilities)
        if run_trivy:
            trivy_data = analyze_with_trivy(clone_path, trivy_path, trivy_cache_dir)
            if trivy_data:
                trivy_results = {
                    "repository_url": repo_url,
                    "repository_name": repo_name,
                    "analysis_type": "vulnerabilities",
                    "tool": "trivy",
                    "analysis": trivy_data
                }
                output_file = os.path.join(repo_results_dir, "vulnerabilities.json")
                if save_results(trivy_results, output_file):
                    analysis_results['vulnerabilities'] = True
            else:
                analysis_results['vulnerabilities'] = False
        
        # Run CodeMaat analysis (code evolution)
        codemaat_successful = False
        if run_codemaat:
            codemaat_summary = analyze_with_codemaat(clone_path, repo_name, repo_results_dir, codemaat_jar_path)
            if codemaat_summary and codemaat_summary['successful'] > 0:
                print(f"  📊 CodeMaat: {codemaat_summary['successful']}/{codemaat_summary['total']} analyses completed")
                analysis_results['codemaat'] = True
                codemaat_successful = True
            else:
                analysis_results['codemaat'] = False
        
        # Run Hotspot analysis (combines Lizard + CodeMaat)
        # Automatically runs if both Lizard and CodeMaat data are available
        if run_lizard and codemaat_successful and lizard_data:
            hotspot_summary = analyze_hotspots(repo_name, repo_results_dir, lizard_data, True)
            if hotspot_summary:
                analysis_results['hotspots'] = True
            else:
                analysis_results['hotspots'] = False
        
        # Print summary
        print(f"\n  📊 Analysis Summary:")
        for analysis_type, success in analysis_results.items():
            status = "✅" if success else "❌"
            print(f"     {status} {analysis_type.capitalize()}")
        
        # Return True if at least one analysis succeeded
        return any(analysis_results.values())
        
    except Exception as e:
        print(f"  Error processing repository {repo_name}: {e}")
        return False
    finally:
        # Clean up cloned repository
        try:
            if os.path.exists(temp_dir):
                # On Windows, sometimes files are locked. Try multiple times with delay
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        # Make files writable before deletion (Windows issue)
                        for root, dirs, files in os.walk(temp_dir):
                            for d in dirs:
                                os.chmod(os.path.join(root, d), 0o777)
                            for f in files:
                                os.chmod(os.path.join(root, f), 0o777)
                        
                        shutil.rmtree(temp_dir)
                        print(f"  Cleaned up temporary files")
                        break
                    except Exception as e:
                        if attempt < max_retries - 1:
                            time.sleep(1)  # Wait 1 second before retry
                        else:
                            print(f"  Warning: Failed to clean up {temp_dir}: {e}")
                            print(f"  You may need to manually delete: {temp_dir}")
        except Exception as e:
            print(f"  Warning: Failed to clean up {temp_dir}: {e}")


def read_repository_list(file_path):
    """Read repository URLs from text file"""
    repositories = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                # Skip empty lines and comments
                if line and not line.startswith('#'):
                    repositories.append(line)
        return repositories
    except FileNotFoundError:
        print(f"Error: File not found: {file_path}")
        return None
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(
        description='Analyze GitLab repositories using multiple analysis tools',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Analysis Tools:
  - Git Commit History: Extract commit data (last 2 years) - Always enabled
  - SCC: Source code counter (tech stack) - Always enabled
  - Lizard: Code complexity analysis - Enabled by default (use --no-lizard to disable)
  - Trivy: Vulnerability scanning - Disabled by default (use --trivy to enable)
  - CodeMaat: Code evolution analysis (last 2 years) - Disabled by default (use --codemaat to enable)

Examples:
  python3 analyze_repos.py repos.txt
  python3 analyze_repos.py repos.txt -o /path/to/results
  python3 analyze_repos.py repos.txt --trivy --codemaat
  python3 analyze_repos.py repos.txt --no-lizard --trivy
  python3 analyze_repos.py repos.txt --scc-path /usr/local/bin/scc
  python3 analyze_repos.py repos.txt --trivy --trivy-path ./tools/trivy
  python3 analyze_repos.py repos.txt --codemaat --codemaat-jar-path ./tools/cm.jar
  
Input file format (one repository URL per line):
  https://gitlab.com/user/repo1.git
  https://gitlab.com/user/repo2
  # This is a comment
  https://gitlab.com/user/repo3.git

Output structure:
  results/
    {repo_name}/
      commits.json (Git commit history - last 2 years)
      techStack.json (SCC results)
      complexity.json (Lizard results, if enabled)
      vulnerabilities.json (Trivy results, if enabled)
      {repo_name}_cm_revisions.csv (CodeMaat - if enabled)
      {repo_name}_cm_authors.csv
      {repo_name}_cm_entity_churn.csv
      {repo_name}_cm_coupling.csv
      {repo_name}_cm_communication.csv
      {repo_name}_cm_main_dev.csv
      {repo_name}_cm_entity_effort.csv
      {repo_name}_cm_abs_churn.csv
      {repo_name}_cm_age.csv
      {repo_name}_cm_author_churn.csv
      {repo_name}_cm_entity_ownership.csv
      {repo_name}_cm_fragmentation.csv
      {repo_name}_cm_soc.csv
      {repo_name}_cm_main_dev_by_revs.csv
      {repo_name}_cm_refactoring_main_dev.csv
      {repo_name}_hotspots.csv (Code hotspots - if Lizard + CodeMaat enabled)
    access_error.txt (Failed repositories)
        """
    )
    
    parser.add_argument(
        'input_file',
        help='Path to text file containing GitLab repository URLs (one per line)'
    )
    
    parser.add_argument(
        '-o', '--output-dir',
        default='../results',
        help='Output directory for results (default: ../results)'
    )
    
    parser.add_argument(
        '--scc-path',
        default=SCC_PATH,
        help=f'Path to SCC executable (default: {SCC_PATH})'
    )
    
    parser.add_argument(
        '--trivy-path',
        default=TRIVY_PATH,
        help=f'Path to Trivy executable (default: {TRIVY_PATH})'
    )
    
    parser.add_argument(
        '--trivy-cache-dir',
        default=TRIVY_CACHE_DIR,
        help=f'Path to Trivy cache directory for offline mode (default: {TRIVY_CACHE_DIR}). Set to empty string to disable offline cache.'
    )
    
    parser.add_argument(
        '--no-lizard',
        action='store_true',
        help='Disable Lizard code complexity analysis (enabled by default)'
    )
    
    parser.add_argument(
        '--trivy',
        action='store_true',
        help='Enable Trivy vulnerability scanning (disabled by default)'
    )
    
    parser.add_argument(
        '--codemaat',
        action='store_true',
        help='Enable CodeMaat evolution analysis (disabled by default)'
    )
    
    parser.add_argument(
        '--codemaat-jar-path',
        default=CODEMAAT_JAR_PATH,
        help=f'Path to CodeMaat JAR file (default: {CODEMAAT_JAR_PATH})'
    )
    
    args = parser.parse_args()
    
    # Use the tool paths from arguments or configuration
    scc_path = args.scc_path
    trivy_path = args.trivy_path
    trivy_cache_dir = args.trivy_cache_dir if args.trivy_cache_dir else None
    codemaat_jar_path = args.codemaat_jar_path
    
    # Check if scc is installed
    print(f"Using SCC from: {scc_path}")
    if not check_scc_installed(scc_path):
        print(f"Error: 'scc' command not found at: {scc_path}")
        print("Please install SCC from: https://github.com/boyter/scc")
        print("\nInstallation options:")
        print("  - macOS: brew install scc")
        print("  - Or download from: https://github.com/boyter/scc/releases")
        print("\nYou can specify the path using:")
        print("  - Edit SCC_PATH in the script")
        print("  - Use --scc-path argument")
        sys.exit(1)
    
    # Read repository list
    print(f"Reading repository list from: {args.input_file}")
    repositories = read_repository_list(args.input_file)
    
    if not repositories:
        print("No repositories found in input file.")
        sys.exit(1)
    
    print(f"Found {len(repositories)} repositories to process\n")
    
    # Setup directories
    script_dir = os.path.dirname(os.path.abspath(__file__))
    results_dir = os.path.abspath(os.path.join(script_dir, args.output_dir))
    
    # Create a temporary base directory for cloning
    temp_base_dir = tempfile.mkdtemp(prefix="repo_analysis_")
    print(f"Using temporary directory: {temp_base_dir}")
    
    # Determine which analyses to run
    run_lizard = not args.no_lizard
    run_trivy = args.trivy
    run_codemaat = args.codemaat
    
    # Display configuration
    print(f"\nAnalysis Configuration:")
    print(f"  Git Commits: ✅ Always enabled (last 2 years)")
    print(f"  SCC (TechStack): ✅ Always enabled")
    print(f"  Lizard (Complexity): {'✅ Enabled' if run_lizard else '❌ Disabled'}")
    print(f"  Trivy (Vulnerabilities): {'✅ Enabled' if run_trivy else '❌ Disabled'}")
    print(f"  CodeMaat (Evolution): {'✅ Enabled (last 2 years)' if run_codemaat else '❌ Disabled'}")
    print()
    
    try:
        # Process each repository
        successful = 0
        failed = 0
        
        for repo_url in repositories:
            if process_repository(repo_url, results_dir, temp_base_dir, scc_path, trivy_path, trivy_cache_dir, codemaat_jar_path,
                                run_lizard=run_lizard, run_trivy=run_trivy, run_codemaat=run_codemaat):
                successful += 1
            else:
                failed += 1
        
        # Summary
        print("\n" + "="*60)
        print("SUMMARY")
        print("="*60)
        print(f"Total repositories: {len(repositories)}")
        print(f"Successfully processed: {successful}")
        print(f"Failed: {failed}")
        if failed > 0:
            error_file = os.path.join(results_dir, 'access_error.txt')
            if os.path.exists(error_file):
                print(f"Access errors logged in: {error_file}")
        print(f"Results directory: {results_dir}")
        print("="*60)
        
    finally:
        # Clean up temporary base directory
        try:
            if os.path.exists(temp_base_dir):
                shutil.rmtree(temp_base_dir)
                print(f"\nCleaned up temporary directory: {temp_base_dir}")
        except Exception as e:
            print(f"\nWarning: Failed to clean up {temp_base_dir}: {e}")


if __name__ == "__main__":
    main()

