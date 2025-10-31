#!/usr/bin/env python3
"""
Script to analyze GitLab repositories using multiple analysis tools:
- Git Commit History: Extract commit data (last 2 years)
- TechStack: Source code counter (tech stack analysis)
- Complexity: Code complexity analysis
- Trivy: Vulnerability scanning
- CodeAnalysis: Code evolution analysis (last 2 years)
- Hotspot Analysis: Identify high-risk code (high complexity + high change frequency)
- Developer Ranking: Weighted contributor ranking (automatic if CodeAnalysis enabled)

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
from pathlib import Path

# ============================================================================
# CONFIGURATION
# ============================================================================
TechStack_PATH = 'scc'  # Default: use 'scc' from system PATH
#TechStack_PATH = 'C:\\devhome\\projects\\scc\\scc.exe'

TRIVY_PATH = 'trivy'  # Default: use 'trivy' from system PATH
#TRIVY_PATH = 'C:\\devhome\\projects\\tools\\trivy.exe'

TRIVY_CACHE_DIR = './tools/trivy-cache'  # Default: use local cache in tools directory
#TRIVY_CACHE_DIR = 'C:\\devhome\\projects\\tools\\trivy.exe'

CODEMAAT_JAR_PATH = './tools/cm.jar'  # Default: use cm.jar in tools directory
#CODEMAAT_JAR_PATH = 'C:\\devhome\\projects\\tools\\cm.jar'
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


def clone_or_update_repository(repo_url, clone_dir):
    """Clone a repository or update it if it already exists"""
    
    # Check if repository already exists
    if os.path.exists(clone_dir) and os.path.exists(os.path.join(clone_dir, '.git')):
        print(f"  Repository already exists, checking for updates...")
        try:
            # Fetch latest changes
            fetch_cmd = ["git", "-C", clone_dir, "fetch", "--all"]
            fetch_result = subprocess.run(
                fetch_cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            if fetch_result.returncode != 0:
                print(f"  Warning: Failed to fetch updates: {fetch_result.stderr}")
            
            # Get current branch
            branch_cmd = ["git", "-C", clone_dir, "rev-parse", "--abbrev-ref", "HEAD"]
            branch_result = subprocess.run(
                branch_cmd,
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if branch_result.returncode == 0:
                current_branch = branch_result.stdout.strip()
                
                # Pull latest changes
                pull_cmd = ["git", "-C", clone_dir, "pull", "origin", current_branch]
                pull_result = subprocess.run(
                    pull_cmd,
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                
                if pull_result.returncode == 0:
                    if "Already up to date" in pull_result.stdout:
                        print(f"  Repository is already up to date")
                    else:
                        print(f"  Repository updated successfully")
                    return True, None
                else:
                    print(f"  Warning: Failed to pull updates: {pull_result.stderr}")
                    print(f"  Continuing with existing repository state...")
                    return True, None
            else:
                print(f"  Warning: Could not determine current branch")
                print(f"  Continuing with existing repository state...")
                return True, None
                
        except subprocess.TimeoutExpired:
            print(f"  Warning: Update operation timed out")
            print(f"  Continuing with existing repository state...")
            return True, None
        except Exception as e:
            print(f"  Warning: Failed to update repository: {e}")
            print(f"  Continuing with existing repository state...")
            return True, None
    
    # Repository doesn't exist, clone it
    print(f"  Cloning repository: {repo_url}")
    try:
        # Create parent directory if it doesn't exist
        parent_dir = os.path.dirname(clone_dir)
        if parent_dir and not os.path.exists(parent_dir):
            os.makedirs(parent_dir, exist_ok=True)
        
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
        print(f"  Repository cloned successfully")
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
        # Use pipe delimiter to avoid JSON escaping issues with commit messages
        cmd = [
            "git", "-C", repo_path,
            "log", "--all",
            "--since=2.years",  # Only commits from last 2 years
            "--date=iso-strict",
            "--pretty=format:%H|%an|%ae|%ad|%s"  # Use pipe delimiter
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
        
        # Parse each line and create JSON objects
        commits = []
        for line in result.stdout.strip().split('\n'):
            if line.strip():
                try:
                    # Split by pipe delimiter (max 5 parts to handle pipes in messages)
                    parts = line.split('|', 4)
                    if len(parts) >= 5:
                        commit = {
                            "hash": parts[0],
                            "author_name": parts[1],
                            "author_email": parts[2],
                            "date": parts[3],
                            "message": parts[4]  # Keep original message
                        }
                        commits.append(commit)
                except Exception:
                    # Silently skip malformed lines
                    continue
        
        print(f"  Collected {len(commits)} commits")
        return commits
        
    except subprocess.TimeoutExpired:
        print(f"  Warning: Commit collection timed out")
        return None
    except Exception as e:
        print(f"  Error collecting commit data: {e}")
        return None


def analyze_with_scc(repo_path, scc_path):
    """Run scc on the repository and return JSON output"""
    print(f"  Running TechStack analysis...")
    # Run scc with JSON format output
    # Use shell=True to handle path with spaces or special characters
    result = run_command(f'"{scc_path}" --format json', cwd=repo_path)
    
    if result:
        try:
            return json.loads(result)
        except json.JSONDecodeError as e:
            print(f"  Error parsing TechStack output: {e}")
            return None
    return None


def analyze_with_lizard(repo_path):
    """Run Complexity code complexity analysis using subprocess"""
    print(f"  Running Complexity complexity analysis...")
    try:
        # Determine Python command (python3 on Unix/Mac, python on Windows)
        python_cmd = sys.executable if sys.executable else "python"
        
        # Run lizard via subprocess with CSV output for easier parsing
        cmd = [
            python_cmd, "-m", "lizard",
            "--csv",
            # Exclude common infrastructure directories
            "-x", "*/node_modules/*",
            "-x", "*/venv/*",
            "-x", "*/env/*",
            "-x", "*/__pycache__/*",
            "-x", "*/.git/*",
            repo_path
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600  # 10 minute timeout for large repos
        )
        
        if result.returncode != 0 and result.returncode != 120:  # 120 is lizard's "files too complex" code
            print(f"  Warning: Complexity analysis returned error: {result.stderr}")
            return None
        
        if not result.stdout.strip():
            print(f"  Warning: No Complexity output")
            return None
        
        # Parse CSV output (Complexity CSV has no header row)
        # Format: NLOC,CCN,token,PARAM,length,location,file,function,long_name,start_line,end_line
        functions_list = []
        csv_reader = csv.reader(StringIO(result.stdout))
        
        for row in csv_reader:
            try:
                if len(row) >= 11:  # Ensure we have all expected columns
                    functions_list.append({
                        'nloc': int(row[0]),
                        'cyclomatic_complexity': int(row[1]),
                        'token_count': int(row[2]),
                        'parameter_count': int(row[3]),
                        'length': int(row[4]),
                        'file': row[6],
                        'name': row[7],
                        'long_name': row[8],
                        'start_line': int(row[9]),
                        'end_line': int(row[10]),
                    })
            except (ValueError, IndexError) as e:
                # Skip malformed rows
                continue
        
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
            
            # Sort by complexity (highest first) to capture most important functions
            functions_list.sort(key=lambda x: x['cyclomatic_complexity'], reverse=True)
        else:
            summary = {
                'total_functions': 0,
                'average_complexity': 0,
                'max_complexity': 0,
                'min_complexity': 0
            }
        
        print(f"  Found {summary['total_functions']} functions")
        
        return {
            'summary': summary,
            'functions': functions_list[:500]  # Limit to top 500 most complex functions
        }
        
    except FileNotFoundError:
        print(f"  Warning: Complexity not found. Skipping complexity analysis.")
        print(f"  Install with: pip install lizard")
        return None
    except subprocess.TimeoutExpired:
        print(f"  Warning: Complexity analysis timed out.")
        return None
    except Exception as e:
        print(f"  Error running Complexity analysis: {e}")
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


def analyze_with_codeanalysis(repo_path, repo_name, repo_results_dir, jar_path='./tools/cm.jar'):
    """Run CodeAnalysis evolution analysis (last 2 years) - All 15 analysis types
    
    Saves each analysis as a separate CSV file:
    - {repo}_cm_revisions.csv
    - {repo}_cm_authors.csv
    - etc.
    """
    print(f"  Running CodeAnalysis evolution analysis (15 types, last 2 years)...")
    
    try:
        # Check if CodeAnalysis exists
        if not os.path.isfile(jar_path):
            print(f"  Warning: CodeAnalysis JAR not found at: {jar_path}")
            print(f"  Skipping CodeAnalysis analysis.")
            return None
        
        # Check if Java is available
        try:
            subprocess.run(["java", "-version"], capture_output=True, timeout=5)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            print(f"  Warning: Java not found. CodeAnalysis requires Java.")
            return None
        
        # Extract git log in CodeAnalysis format (last 2 years)
        print(f"  Extracting git log for CodeAnalysis...")
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
            print(f"  Warning: Failed to extract git log for CodeAnalysis")
            return None
        
        git_log = log_result.stdout
        
        # Save git log to file for future use
        log_filename = f"{repo_name}_code-analysis.log"
        log_path = os.path.join(repo_results_dir, log_filename)
        try:
            with open(log_path, 'w', encoding='utf-8') as f:
                f.write(git_log)
            print(f"  Git log saved: {log_filename}")
        except Exception as e:
            print(f"  Warning: Failed to save git log: {e}")
        
        # Run all available CodeAnalysis analyses
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
                # Run CodeAnalysis analysis using the saved log file
                cmd = [
                    "java", "-jar", jar_path,
                    "-l", log_path,
                    "-c", "git2",
                    "-a", analysis_type
                ]
                
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                
                if result.returncode == 0 and result.stdout.strip():
                    # Save CSV output directly to file
                    csv_filename = f"{repo_name}_code-analysis_{analysis_type.replace('-', '_')}.csv"
                    csv_path = os.path.join(repo_results_dir, csv_filename)
                    
                    with open(csv_path, 'w', encoding='utf-8') as f:
                        f.write(result.stdout)
                    
                    # Count entries (lines - 1 for header)
                    entries_count = len(result.stdout.strip().split('\n')) - 1
                    print(f"  {analysis_type}: {entries_count} entries -> {csv_filename}")
                    successful_analyses += 1
                else:
                    print(f"  Warning: {analysis_type}: No data or analysis failed")
                    failed_analyses += 1
                    
            except Exception as e:
                print(f"  Warning: {analysis_type}: {str(e)}")
                failed_analyses += 1
        
        # Return summary
        return {
            "successful": successful_analyses,
            "failed": failed_analyses,
            "total": len(analyses_to_run)
        }
        
    except Exception as e:
        print(f"  Error running CodeAnalysis analysis: {e}")
        return None


def analyze_hotspots(repo_name, repo_results_dir, complexity_data, codeanalysis_enabled):
    """
    Identify code hotspots by combining revisions (change frequency) and complexity.
    
    Hotspots = High change frequency + High complexity
    These are high-risk areas that need attention.
    """
    if not codeanalysis_enabled:
        return None
    
    print(f"  Analyzing code hotspots...")
    
    try:
        # 1. Load revisions data (change frequency from CodeAnalysis)
        revisions_file = os.path.join(repo_results_dir, f"{repo_name}_code-analysis_revisions.csv")
        
        if not os.path.exists(revisions_file):
            print(f"  Warning: Revisions file not found, skipping hotspot analysis")
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
            print(f"  Warning: No revision data found")
            return None
        
        # 2. Aggregate complexity by file from Complexity data
        if not complexity_data or not complexity_data.get('functions'):
            print(f"  Warning: No complexity data available")
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
        
        # Calculate averages and normalize paths for efficient matching
        normalized_complexity = {}
        for file_path in file_complexity:
            file_complexity[file_path]['avg_complexity'] = round(
                file_complexity[file_path]['total_complexity'] / 
                file_complexity[file_path]['function_count'], 
                2
            )
            # Normalize path for matching (use forward slashes, lowercase for case-insensitive)
            normalized_key = os.path.normpath(file_path).replace('\\', '/').lower()
            normalized_complexity[normalized_key] = (file_path, file_complexity[file_path])
        
        # 3. Combine revisions + complexity to find hotspots
        print(f"  Matching {len(revisions)} files with {len(file_complexity)} complexity entries...")
        hotspots = []
        unmatched_count = 0
        
        try:
            for idx, (file_path, revs) in enumerate(revisions.items()):
                # Progress indicator for large datasets (every 1000 files)
                if idx > 0 and idx % 1000 == 0:
                    print(f"  Progress: {idx}/{len(revisions)} files processed...")
                
                # Try to match file paths (CodeAnalysis may have different path format)
                matched_complexity = None
                
                # Normalize revision file path
                norm_rev_path = os.path.normpath(file_path).replace('\\', '/').lower()
                
                # Try direct match first (fastest - O(1) lookup)
                if norm_rev_path in normalized_complexity:
                    _, matched_complexity = normalized_complexity[norm_rev_path]
                else:
                    # Try suffix matching only if needed (slower - O(n) worst case)
                    # This handles cases where paths differ (e.g., relative vs absolute)
                    for norm_complex_path, (original_path, complexity_data) in normalized_complexity.items():
                        if norm_complex_path.endswith(norm_rev_path) or norm_rev_path.endswith(norm_complex_path):
                            matched_complexity = complexity_data
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
                else:
                    unmatched_count += 1
        
        except Exception as e:
            print(f"  Error during hotspot matching: {e}")
            print(f"  Processed {len(hotspots)} hotspots before error")
            if len(hotspots) == 0:
                return None
        
        # Report matching statistics
        match_rate = round((len(hotspots) / len(revisions) * 100), 1) if revisions else 0
        print(f"  Matched {len(hotspots)}/{len(revisions)} files ({match_rate}%)")
        if unmatched_count > 0:
            print(f"  Note: {unmatched_count} files have no complexity data (non-code files or excluded)")
        
        if not hotspots:
            print(f"  Warning: No hotspots identified (no files matched complexity data)")
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
        
        print(f"  Hotspots identified: {len(hotspots)} files")
        print(f"     CRITICAL: {risk_counts['CRITICAL']}, "
              f"HIGH: {risk_counts['HIGH']}, "
              f"MEDIUM: {risk_counts['MEDIUM']}, "
              f"LOW: {risk_counts['LOW']}")
        print(f"     Saved to: {csv_filename}")
        
        return {
            'total_hotspots': len(hotspots),
            'risk_counts': risk_counts,
            'top_5': hotspots[:5]
        }
        
    except Exception as e:
        print(f"  Error analyzing hotspots: {e}")
        return None


def run_geographic_analysis(commits_file, output_dir):
    """
    Run geographic distribution analysis on commits.json file.
    Calls analyze_geo_distribution.py as a subprocess.
    """
    try:
        # Get the path to analyze_geo_distribution.py script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        geo_script = os.path.join(script_dir, 'analyze_geo_distribution.py')
        
        # Check if script exists
        if not os.path.exists(geo_script):
            print(f"  Warning: Geographic analysis script not found: {geo_script}")
            return False
        
        # Determine Python command (python3 on Unix/Mac, python on Windows)
        python_cmd = sys.executable if sys.executable else "python"
        
        # Run the geographic analysis script
        output_file = os.path.join(output_dir, 'geographic_distribution.json')
        
        result = subprocess.run(
            [python_cmd, geo_script, commits_file, output_file],
            capture_output=True,
            text=True,
            timeout=60  # 1 minute timeout
        )
        
        if result.returncode == 0:
            print(f"  Geographic distribution analysis completed")
            return True
        else:
            print(f"  Warning: Geographic analysis failed: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print(f"  Warning: Geographic analysis timed out")
        return False
    except Exception as e:
        print(f"  Warning: Could not run geographic analysis: {e}")
        return False


def run_developer_ranking(repo_results_dir, repo_name):
    """
    Run developer ranking analysis on the repository results.
    Calls calculate_developer_ranking.py as a subprocess.
    
    Requires:
    - commits.json
    - *_hotspots.csv
    - CodeAnalysis analysis files
    """
    try:
        # Get the path to calculate_developer_ranking.py script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        ranking_script = os.path.join(script_dir, 'calculate_developer_ranking.py')
        
        # Check if script exists
        if not os.path.exists(ranking_script):
            print(f"  Warning: Developer ranking script not found: {ranking_script}")
            return False
        
        # Check if required files exist
        required_files = [
            os.path.join(repo_results_dir, 'commits.json'),
            os.path.join(repo_results_dir, f'{repo_name}_hotspots.csv'),
            os.path.join(repo_results_dir, f'{repo_name}_code-analysis_entity_ownership.csv'),
            os.path.join(repo_results_dir, f'{repo_name}_code-analysis_main_dev.csv')
        ]
        
        missing_files = [f for f in required_files if not os.path.exists(f)]
        if missing_files:
            print(f"  Skipping developer ranking: Missing required files")
            return False
        
        # Determine Python command
        python_cmd = sys.executable if sys.executable else "python"
        
        # Prepare output paths
        json_output = os.path.join(repo_results_dir, 'developer_rankings.json')
        csv_output = os.path.join(repo_results_dir, 'developer_rankings.csv')
        
        # Run the developer ranking script
        result = subprocess.run(
            [
                python_cmd, ranking_script,
                repo_results_dir,
                '--output-json', json_output,
                '--output-csv', csv_output,
                '--top', '50'  # Show top 50 in console
            ],
            capture_output=True,
            text=True,
            timeout=120  # 2 minute timeout
        )
        
        if result.returncode == 0:
            print(f"  Developer ranking analysis completed")
            print(f"     Rankings saved to:")
            print(f"       - {os.path.basename(json_output)}")
            print(f"       - {os.path.basename(csv_output)}")
            return True
        else:
            print(f"  Warning: Developer ranking failed: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print(f"  Warning: Developer ranking timed out")
        return False
    except Exception as e:
        print(f"  Warning: Could not run developer ranking: {e}")
        return False


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


def process_repository(repo_url, results_dir, repos_base_dir, scc_path, trivy_path='trivy', trivy_cache_dir=None, codeanalysis_jar_path=None, run_lizard=True, run_trivy=False, run_codeanalysis=False):
    """Process a single repository: clone/update, analyze, and save results"""
    repo_name = extract_repo_name(repo_url)
    print(f"\nProcessing: {repo_name}")
    print(f"="*60)
    
    # Create a dedicated results directory for this repository
    repo_results_dir = os.path.join(results_dir, repo_name)
    os.makedirs(repo_results_dir, exist_ok=True)
    
    # Use persistent repository directory instead of temporary
    clone_path = os.path.join(repos_base_dir, repo_name)
    
    try:
        # Clone or update the repository
        clone_success, clone_error = clone_or_update_repository(repo_url, clone_path)
        if not clone_success:
            print(f"  Failed to clone repository: {repo_url}")
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
                
                # Run geographic distribution analysis on commits
                run_geographic_analysis(output_file, repo_results_dir)
        else:
            analysis_results['commits'] = False
        
        # Run TechStack analysis (tech stack)
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
            print(f"  Warning: TechStack analysis failed")
            analysis_results['techstack'] = False
        
        # Run Complexity analysis (code complexity)
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
        
        # Run CodeAnalysis analysis (code evolution)
        codeanalysis_successful = False
        if run_codeanalysis:
            codeanalysis_summary = analyze_with_codeanalysis(clone_path, repo_name, repo_results_dir, codeanalysis_jar_path)
            if codeanalysis_summary and codeanalysis_summary['successful'] > 0:
                print(f"  CodeAnalysis: {codeanalysis_summary['successful']}/{codeanalysis_summary['total']} analyses completed")
                analysis_results['codeanalysis'] = True
                codeanalysis_successful = True
            else:
                analysis_results['codeanalysis'] = False
        
        # Run Hotspot analysis (combines Complexity + CodeAnalysis)
        # Automatically runs if both Complexity and CodeAnalysis data are available
        hotspot_successful = False
        if run_lizard and codeanalysis_successful and lizard_data:
            hotspot_summary = analyze_hotspots(repo_name, repo_results_dir, lizard_data, True)
            if hotspot_summary:
                analysis_results['hotspots'] = True
                hotspot_successful = True
            else:
                analysis_results['hotspots'] = False
        
        # Run Developer Ranking analysis (automatic if CodeAnalysis + hotspots are available)
        if codeanalysis_successful and hotspot_successful:
            if run_developer_ranking(repo_results_dir, repo_name):
                analysis_results['developer_ranking'] = True
            else:
                analysis_results['developer_ranking'] = False
        
        # Print summary
        print(f"\n  Analysis Summary:")
        for analysis_type, success in analysis_results.items():
            status = "[OK]" if success else "[FAIL]"
            print(f"     {status} {analysis_type.capitalize()}")
        
        # Return True if at least one analysis succeeded
        return any(analysis_results.values())
        
    except Exception as e:
        print(f"  Error processing repository {repo_name}: {e}")
        return False


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
  - Geographic Distribution: Analyze developer locations from commit timezones - Always enabled
  - TechStack: Source code counter (tech stack) - Always enabled
  - Complexity: Code complexity analysis - Enabled by default (use --no-lizard to disable)
  - Trivy: Vulnerability scanning - Disabled by default (use --trivy to enable)
  - CodeAnalysis: Code evolution analysis (last 2 years) - Disabled by default (use --codeanalysis to enable)
  - Developer Ranking: Weighted contributor analysis - Automatic when CodeAnalysis + hotspots enabled

Examples:
  python3 analyze_repos.py repos.txt
  python3 analyze_repos.py repos.txt -o /path/to/results
  python3 analyze_repos.py repos.txt --trivy --codeanalysis
  python3 analyze_repos.py repos.txt --no-lizard --trivy
  python3 analyze_repos.py repos.txt --scc-path /usr/local/bin/scc
  python3 analyze_repos.py repos.txt --trivy --trivy-path ./tools/trivy
  python3 analyze_repos.py repos.txt --codeanalysis --codeanalysis-jar-path ./tools/cm.jar
  
Input file format (one repository URL per line):
  https://gitlab.com/user/repo1.git
  https://gitlab.com/user/repo2
  # This is a comment
  https://gitlab.com/user/repo3.git

Output structure:
  repositories/
    {repo_name}/ (Cloned repository - persisted and reused on subsequent runs)
  results/
    {repo_name}/
      commits.json (Git commit history - last 2 years)
      geographic_distribution.json (Geographic distribution analysis from commit timezones)
      techStack.json (TechStack results)
      complexity.json (Complexity results, if enabled)
      vulnerabilities.json (Trivy results, if enabled)
      {repo_name}_code-analysis.log (Git log in CodeAnalysis format - if CodeAnalysis enabled)
      {repo_name}_code-analysis_revisions.csv (CodeAnalysis - if enabled)
      {repo_name}_code-analysis_authors.csv
      {repo_name}_code-analysis_entity_churn.csv
      {repo_name}_code-analysis_coupling.csv
      {repo_name}_code-analysis_communication.csv
      {repo_name}_code-analysis_main_dev.csv
      {repo_name}_code-analysis_entity_effort.csv
      {repo_name}_code-analysis_abs_churn.csv
      {repo_name}_code-analysis_age.csv
      {repo_name}_code-analysis_author_churn.csv
      {repo_name}_code-analysis_entity_ownership.csv
      {repo_name}_code-analysis_fragmentation.csv
      {repo_name}_code-analysis_soc.csv
      {repo_name}_code-analysis_main_dev_by_revs.csv
      {repo_name}_code-analysis_refactoring_main_dev.csv
      {repo_name}_hotspots.csv (Code hotspots - if Complexity + CodeAnalysis enabled)
      developer_rankings.json (Developer rankings - automatic if CodeAnalysis + hotspots enabled)
      developer_rankings.csv (Developer rankings CSV - automatic if CodeAnalysis + hotspots enabled)
    access_error.txt (Failed repositories)

Note: Repositories are cloned to ./repositories and kept for future runs.
      On subsequent runs, the script will update existing repositories instead of re-cloning.
        """
    )
    
    parser.add_argument(
        'input_file',
        help='Path to text file containing GitLab repository URLs (one per line)'
    )
    
    parser.add_argument(
        '-o', '--output-dir',
        default='./results',
        help='Output directory for results (default: ./results)'
    )
    
    parser.add_argument(
        '--scc-path',
        default=TechStack_PATH,
        help=f'Path to TechStack executable (default: {TechStack_PATH})'
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
        help='Disable Complexity code complexity analysis (enabled by default)'
    )
    
    parser.add_argument(
        '--trivy',
        action='store_true',
        help='Enable Trivy vulnerability scanning (disabled by default)'
    )
    
    parser.add_argument(
        '--codeanalysis',
        action='store_true',
        help='Enable CodeAnalysis evolution analysis (disabled by default)'
    )
    
    parser.add_argument(
        '--codeanalysis-jar-path',
        default=CODEMAAT_JAR_PATH,
        help=f'Path to CodeAnalysis JAR file (default: {CODEMAAT_JAR_PATH})'
    )
    
    args = parser.parse_args()
    
    # Use the tool paths from arguments or configuration
    scc_path = args.scc_path
    trivy_path = args.trivy_path
    trivy_cache_dir = args.trivy_cache_dir if args.trivy_cache_dir else None
    codeanalysis_jar_path = args.codeanalysis_jar_path
    
    # Check if scc is installed
    print(f"Using TechStack from: {scc_path}")
    if not check_scc_installed(scc_path):
        print(f"Error: 'scc' command not found at: {scc_path}")
        print("Please install TechStack from: https://github.com/boyter/scc")
        print("\nInstallation options:")
        print("  - macOS: brew install scc")
        print("  - Or download from: https://github.com/boyter/scc/releases")
        print("\nYou can specify the path using:")
        print("  - Edit TechStack_PATH in the script")
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
    
    # Create a persistent repositories directory
    repos_base_dir = os.path.abspath(os.path.join(script_dir, 'repositories'))
    if not os.path.exists(repos_base_dir):
        os.makedirs(repos_base_dir, exist_ok=True)
    print(f"Using repositories directory: {repos_base_dir}")
    
    # Determine which analyses to run
    run_lizard = not args.no_lizard
    run_trivy = args.trivy
    run_codeanalysis = args.codeanalysis
    
    # Display configuration
    print(f"\nAnalysis Configuration:")
    print(f"  Git Commits: Always enabled (last 2 years)")
    print(f"  Geographic Distribution: Always enabled")
    print(f"  TechStack (TechStack): Always enabled")
    print(f"  Complexity (Complexity): {'Enabled' if run_lizard else 'Disabled'}")
    print(f"  Trivy (Vulnerabilities): {'Enabled' if run_trivy else 'Disabled'}")
    print(f"  CodeAnalysis (Evolution): {'Enabled (last 2 years)' if run_codeanalysis else 'Disabled'}")
    if run_codeanalysis and run_lizard:
        print(f"  Developer Ranking: Will run automatically (CodeAnalysis + Complexity enabled)")
    else:
        print(f"  Developer Ranking: Disabled (requires CodeAnalysis + Complexity)")
    print()
    
    # Process each repository
    successful = 0
    failed = 0
    
    for repo_url in repositories:
        if process_repository(repo_url, results_dir, repos_base_dir, scc_path, trivy_path, trivy_cache_dir, codeanalysis_jar_path,
                            run_lizard=run_lizard, run_trivy=run_trivy, run_codeanalysis=run_codeanalysis):
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
    print(f"Repositories directory: {repos_base_dir}")
    print(f"Results directory: {results_dir}")
    print("="*60)


if __name__ == "__main__":
    main()

