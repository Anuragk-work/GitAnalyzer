#!/usr/bin/env python3
"""
Standalone Git Repository Analyzer for Windows
Analyzes cloned git repositories using internal and external tools.
Outputs results as JSON files.

Usage:
    analyzer.exe --repo C:\path\to\cloned\repo
    analyzer.exe --repo C:\path\to\cloned\repo --output C:\results
    analyzer.exe --repo C:\path\to\cloned\repo --tools history,techstack,quality
"""

import argparse
import json
import logging
import os
import shutil
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import re
import csv
from io import StringIO

# Version information
VERSION = "1.0.0"
BUILD_DATE = "2025-10-29"

# Configure logging
def setup_logging(log_file: Optional[Path] = None):
    """Configure logging to console and optionally to file."""
    log_format = '%(asctime)s - %(levelname)s - %(message)s'
    
    handlers = [logging.StreamHandler(sys.stdout)]
    
    if log_file:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_file))
    
    logging.basicConfig(
        level=logging.INFO,
        format=log_format,
        handlers=handlers
    )
    
    return logging.getLogger("standalone-analyzer")


class ProgressTracker:
    """Track and display progress of analysis."""
    
    def __init__(self, total_steps: int):
        self.total_steps = total_steps
        self.current_step = 0
        self.logger = logging.getLogger("standalone-analyzer")
    
    def start_step(self, step_name: str):
        """Start a new analysis step."""
        self.current_step += 1
        progress = (self.current_step / self.total_steps) * 100
        self.logger.info(f"[{self.current_step}/{self.total_steps}] ({progress:.0f}%) {step_name}")
    
    def complete_step(self, step_name: str, success: bool = True):
        """Mark a step as complete."""
        status = "✅" if success else "❌"
        self.logger.info(f"{status} {step_name} {'completed' if success else 'failed'}")


class GitLogExtractor:
    """Extract git logs in various formats for tool consumption."""
    
    def __init__(self, repo_path: Path, output_dir: Path):
        self.repo_path = repo_path
        self.output_dir = output_dir
        self.logger = logging.getLogger("standalone-analyzer")
        
        # Create output directory
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def extract_repository_history(self) -> Optional[Path]:
        """Extract git log for repository history analysis."""
        try:
            self.logger.info(f"📊 Extracting repository history log...")
            
            output_file = self.output_dir / "repository_history.log"
            
            cmd = [
                "git", "-C", str(self.repo_path),
                "log", "--stat", "--numstat",
                "--pretty=format:===COMMIT===%n%h|%an|%ae|%ad|%tz",
                "--date=format:%Y-%m-%d %H:%M:%S %z"
            ]
            
            with open(output_file, 'w', encoding='utf-8') as f:
                result = subprocess.run(
                    cmd, 
                    stdout=f, 
                    stderr=subprocess.PIPE, 
                    text=True, 
                    timeout=600
                )
            
            if result.returncode != 0:
                self.logger.error(f"Git command failed: {result.stderr}")
                return None
            
            self.logger.info(f"✅ Repository history log extracted: {output_file}")
            return output_file
            
        except Exception as e:
            self.logger.error(f"❌ Failed to extract repository history: {e}")
            return None
    
    def extract_commit_analysis(self) -> Optional[Path]:
        """Extract git log with commit messages for classification analysis."""
        try:
            self.logger.info(f"📝 Extracting commit messages...")
            
            output_file = self.output_dir / "commit_analysis.log"
            
            cmd = [
                "git", "-C", str(self.repo_path),
                "log", "--stat", "--numstat",
                "--pretty=format:===COMMIT_START===%n%h|%an|%ae|%ad%n===MESSAGE_START===%n%B%n===MESSAGE_END===",
                "--date=format:%Y-%m-%d %H:%M:%S %z"
            ]
            
            with open(output_file, 'w', encoding='utf-8') as f:
                result = subprocess.run(
                    cmd, 
                    stdout=f, 
                    stderr=subprocess.PIPE, 
                    text=True, 
                    timeout=600
                )
            
            if result.returncode != 0:
                self.logger.error(f"Git command failed: {result.stderr}")
                return None
            
            self.logger.info(f"✅ Commit analysis log extracted: {output_file}")
            return output_file
            
        except Exception as e:
            self.logger.error(f"❌ Failed to extract commit analysis: {e}")
            return None
    
    def extract_code_maat(self) -> Optional[Path]:
        """Extract git log for CodeMaat evolution analysis."""
        try:
            self.logger.info(f"📊 Extracting evolution analysis log...")
            
            output_file = self.output_dir / "ext_cm.log"
            
            cmd = [
                "git", "-C", str(self.repo_path),
                "log", "--all", "--numstat", "--date=short",
                "--pretty=format:--%h--%ad--%aN", "--no-renames"
            ]
            
            with open(output_file, 'w', encoding='utf-8') as f:
                result = subprocess.run(
                    cmd, 
                    stdout=f, 
                    stderr=subprocess.PIPE, 
                    text=True, 
                    timeout=600
                )
            
            if result.returncode != 0:
                self.logger.error(f"Git command failed: {result.stderr}")
                return None
            
            self.logger.info(f"✅ Evolution analysis log extracted: {output_file}")
            return output_file
            
        except Exception as e:
            self.logger.error(f"❌ Failed to extract evolution analysis log: {e}")
            return None


class RepositoryHistoryAnalyzer:
    """Analyze git repository history from extracted logs."""
    
    def __init__(self, log_file: Path, repo_name: str):
        self.log_file = log_file
        self.repo_name = repo_name
        self.detailed_commits = []
        self.logger = logging.getLogger("standalone-analyzer")
    
    def analyze(self) -> Dict[str, Any]:
        """Perform comprehensive repository history analysis."""
        try:
            self.logger.info(f"🔍 Analyzing repository history...")
            
            # Parse git log
            self.detailed_commits = self._parse_git_log()
            
            if not self.detailed_commits:
                return {"error": "No commits found", "success": False}
            
            # Perform analyses
            results = {
                "repository_name": self.repo_name,
                "analysis_timestamp": datetime.now().isoformat(),
                "tool": "repository-history-analyzer",
                "basic_metrics": self._analyze_basic_metrics(),
                "contributor_analysis": self._analyze_contributors(),
                "temporal_patterns": self._analyze_temporal_patterns(),
                "hotspot_analysis": self._analyze_hotspots(),
                "code_churn": self._analyze_code_churn(),
                "collaboration_metrics": self._analyze_collaboration(),
                "total_commits": len(self.detailed_commits),
                "success": True
            }
            
            self.logger.info(f"✅ Repository history analysis completed")
            return results
            
        except Exception as e:
            self.logger.error(f"❌ Repository history analysis failed: {e}")
            return {
                "error": str(e),
                "success": False,
                "repository_name": self.repo_name
            }
    
    def _parse_git_log(self) -> List[Dict[str, Any]]:
        """Parse extracted git log file."""
        try:
            with open(self.log_file, 'r', encoding='utf-8') as f:
                git_output = f.read()
            
            commits = []
            commit_data = {}
            current_files = {}
            
            lines = git_output.split('\n')
            i = 0
            
            while i < len(lines):
                line = lines[i].strip()
                
                if line.startswith("===COMMIT==="):
                    i += 1
                    continue
                elif re.match(r"^[0-9a-f]+\|", line):
                    # Save previous commit
                    if commit_data:
                        self._finalize_commit_data(commit_data, current_files)
                        commits.append(commit_data)
                    
                    # Parse new commit
                    parts = line.split("|")
                    if len(parts) >= 4:
                        datetime_tz = parts[3] if len(parts) > 3 else ""
                        datetime_parts = datetime_tz.rsplit(" ", 1)
                        if len(datetime_parts) == 2:
                            datetime_part = datetime_parts[0]
                            timezone_part = datetime_parts[1]
                        else:
                            datetime_part = datetime_tz
                            timezone_part = ""
                        
                        commit_data = {
                            "Commit": parts[0],
                            "Author": parts[1],
                            "Author_Email": parts[2],
                            "DateTime": datetime_part,
                            "Timezone": timezone_part,
                            "Insertions": 0,
                            "Deletions": 0
                        }
                        current_files = {}
                elif "\t" in line and re.match(r"^\d+\s+\d+\s+.+$", line):
                    # Parse file changes
                    parts = line.split('\t')
                    if len(parts) >= 3:
                        try:
                            insertions = int(parts[0]) if parts[0] != '-' else 0
                            deletions = int(parts[1]) if parts[1] != '-' else 0
                            filename = parts[2]
                            current_files[filename] = insertions + deletions
                            commit_data["Insertions"] += insertions
                            commit_data["Deletions"] += deletions
                        except ValueError:
                            continue
                
                i += 1
            
            # Save last commit
            if commit_data:
                self._finalize_commit_data(commit_data, current_files)
                commits.append(commit_data)
            
            return commits
            
        except Exception as e:
            self.logger.error(f"Failed to parse git log: {e}")
            return []
    
    def _finalize_commit_data(self, commit_data: Dict[str, Any], current_files: Dict[str, int]):
        """Finalize commit data with file information."""
        if current_files:
            most_impacted = max(current_files.items(), key=lambda x: x[1])
            commit_data["Most_Impacted_File"] = most_impacted[0]
            commit_data["Changes"] = most_impacted[1]
            commit_data["Changed_Files"] = list(current_files.keys())
            commit_data["Files_Changed"] = len(current_files)
    
    def _analyze_basic_metrics(self) -> Dict[str, Any]:
        """Analyze basic repository metrics."""
        authors = set(c.get("Author", "Unknown") for c in self.detailed_commits)
        
        dates = []
        for commit in self.detailed_commits:
            date_str = commit.get("DateTime", "")
            if date_str:
                try:
                    date_obj = datetime.strptime(date_str[:19], "%Y-%m-%d %H:%M:%S")
                    dates.append(date_obj)
                except ValueError:
                    continue
        
        if not dates:
            return {"error": "No valid dates found"}
        
        first_commit = min(dates)
        last_commit = max(dates)
        age_days = (last_commit - first_commit).days
        
        return {
            "total_commits": len(self.detailed_commits),
            "unique_authors": len(authors),
            "repository_age_days": age_days,
            "first_commit_date": first_commit.isoformat(),
            "last_commit_date": last_commit.isoformat(),
            "commits_per_day": round(len(self.detailed_commits) / max(age_days, 1), 2)
        }
    
    def _analyze_contributors(self) -> Dict[str, Any]:
        """Analyze contributor patterns."""
        author_commits = Counter(c.get("Author", "Unknown") for c in self.detailed_commits)
        
        top_contributors = [
            {
                "name": name,
                "commits": count,
                "percentage": round((count / len(self.detailed_commits)) * 100, 2)
            }
            for name, count in author_commits.most_common(10)
        ]
        
        return {
            "total_contributors": len(author_commits),
            "top_contributors": top_contributors
        }
    
    def _analyze_temporal_patterns(self) -> Dict[str, Any]:
        """Analyze temporal commit patterns."""
        monthly_commits = defaultdict(int)
        daily_commits = defaultdict(int)
        hourly_commits = defaultdict(int)
        
        for commit_data in self.detailed_commits:
            date_str = commit_data.get("DateTime", "")
            if date_str:
                try:
                    dt = datetime.strptime(date_str[:19], "%Y-%m-%d %H:%M:%S")
                    monthly_commits[dt.strftime("%Y-%m")] += 1
                    daily_commits[dt.strftime("%A")] += 1
                    hourly_commits[dt.hour] += 1
                except ValueError:
                    continue
        
        return {
            "commits_by_month": dict(monthly_commits),
            "commits_by_day_of_week": dict(daily_commits),
            "commits_by_hour": dict(hourly_commits)
        }
    
    def _analyze_hotspots(self) -> Dict[str, Any]:
        """Analyze file hotspots."""
        file_changes = defaultdict(int)
        file_authors = defaultdict(set)
        
        for commit_data in self.detailed_commits:
            files_changed = commit_data.get("Changed_Files", [])
            author = commit_data.get("Author", "Unknown")
            
            for file_path in files_changed:
                file_changes[file_path] += 1
                file_authors[file_path].add(author)
        
        hotspots = [
            {
                "file_path": file_path,
                "change_count": count,
                "unique_authors": len(file_authors[file_path])
            }
            for file_path, count in Counter(file_changes).most_common(20)
        ]
        
        return {
            "total_files_changed": len(file_changes),
            "hotspot_files": hotspots
        }
    
    def _analyze_code_churn(self) -> Dict[str, Any]:
        """Analyze code churn metrics."""
        total_insertions = sum(c.get("Insertions", 0) for c in self.detailed_commits)
        total_deletions = sum(c.get("Deletions", 0) for c in self.detailed_commits)
        
        return {
            "total_insertions": total_insertions,
            "total_deletions": total_deletions,
            "net_lines": total_insertions - total_deletions,
            "churn_ratio": round(total_deletions / max(total_insertions, 1), 2),
            "average_insertion_per_commit": round(total_insertions / len(self.detailed_commits), 2),
            "average_deletion_per_commit": round(total_deletions / len(self.detailed_commits), 2)
        }
    
    def _analyze_collaboration(self) -> Dict[str, Any]:
        """Analyze collaboration patterns."""
        file_collaboration = defaultdict(set)
        
        for commit_data in self.detailed_commits:
            author = commit_data.get("Author", "Unknown")
            files_changed = commit_data.get("Changed_Files", [])
            
            for filename in files_changed:
                file_collaboration[filename].add(author)
        
        collaborative_files = {
            file_path: len(authors) 
            for file_path, authors in file_collaboration.items() 
            if len(authors) > 1
        }
        
        return {
            "collaborative_files_count": len(collaborative_files),
            "most_collaborative_files": sorted(
                collaborative_files.items(),
                key=lambda x: x[1],
                reverse=True
            )[:10]
        }


class CommitClassificationAnalyzer:
    """Classify commits based on patterns and messages."""
    
    def __init__(self, log_file: Path, repo_name: str):
        self.log_file = log_file
        self.repo_name = repo_name
        self.logger = logging.getLogger("standalone-analyzer")
    
    def analyze(self) -> Dict[str, Any]:
        """Analyze and classify commits."""
        try:
            self.logger.info(f"📝 Analyzing commit classifications...")
            
            # Parse commit messages
            commits = self._parse_commit_messages()
            
            if not commits:
                return {"error": "No commits with messages found", "success": False}
            
            # Classify commits
            classifications = self._classify_commits(commits)
            
            results = {
                "repository_name": self.repo_name,
                "analysis_timestamp": datetime.now().isoformat(),
                "tool": "commit-classification-analyzer",
                "total_commits": len(commits),
                "classifications": classifications,
                "success": True
            }
            
            self.logger.info(f"✅ Commit classification completed")
            return results
            
        except Exception as e:
            self.logger.error(f"❌ Commit classification failed: {e}")
            return {
                "error": str(e),
                "success": False,
                "repository_name": self.repo_name
            }
    
    def _parse_commit_messages(self) -> List[Dict[str, Any]]:
        """Parse commit messages from log file."""
        try:
            with open(self.log_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            commits = []
            parts = content.split('===COMMIT_START===')
            
            for part in parts[1:]:  # Skip first empty part
                if '===MESSAGE_START===' in part and '===MESSAGE_END===' in part:
                    lines = part.split('\n')
                    header = lines[0] if lines else ""
                    
                    message_start = part.find('===MESSAGE_START===') + len('===MESSAGE_START===')
                    message_end = part.find('===MESSAGE_END===')
                    message = part[message_start:message_end].strip()
                    
                    if '|' in header:
                        parts_header = header.split('|')
                        commits.append({
                            "hash": parts_header[0],
                            "author": parts_header[1] if len(parts_header) > 1 else "",
                            "message": message
                        })
            
            return commits
            
        except Exception as e:
            self.logger.error(f"Failed to parse commit messages: {e}")
            return []
    
    def _classify_commits(self, commits: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Classify commits based on message patterns."""
        categories = {
            "feature": 0,
            "bugfix": 0,
            "refactor": 0,
            "documentation": 0,
            "test": 0,
            "chore": 0,
            "merge": 0,
            "other": 0
        }
        
        patterns = {
            "feature": [r'\bfeat\b', r'\bfeature\b', r'\badd\b', r'\bnew\b'],
            "bugfix": [r'\bfix\b', r'\bbug\b', r'\bissue\b', r'\bpatch\b'],
            "refactor": [r'\brefactor\b', r'\brestructure\b', r'\bclean\b'],
            "documentation": [r'\bdoc\b', r'\bdocs\b', r'\breadme\b', r'\bcomment\b'],
            "test": [r'\btest\b', r'\bspec\b', r'\bcoverage\b'],
            "chore": [r'\bchore\b', r'\bmaint\b', r'\bupdate\b'],
            "merge": [r'\bmerge\b', r'\bMerge branch\b']
        }
        
        for commit in commits:
            message = commit.get("message", "").lower()
            classified = False
            
            for category, pattern_list in patterns.items():
                for pattern in pattern_list:
                    if re.search(pattern, message, re.IGNORECASE):
                        categories[category] += 1
                        classified = True
                        break
                if classified:
                    break
            
            if not classified:
                categories["other"] += 1
        
        return {
            "breakdown": categories,
            "total_classified": len(commits)
        }


class TechStackAnalyzer:
    """Analyze tech stack using SCC tool."""
    
    def __init__(self, repo_path: Path, scc_path: Optional[Path] = None):
        self.repo_path = repo_path
        self.scc_path = scc_path
        self.logger = logging.getLogger("standalone-analyzer")
    
    def analyze(self) -> Dict[str, Any]:
        """Run SCC analysis on repository."""
        try:
            self.logger.info(f"🔧 Running tech stack analysis...")
            
            # Find SCC executable
            scc_cmd = self._find_scc_command()
            if not scc_cmd:
                return {
                    "error": "SCC tool not found. Please install or provide path.",
                    "success": False
                }
            
            # Run SCC
            cmd = [
                scc_cmd,
                "--format", "json",
                "--exclude-dir", ".git,node_modules,venv,__pycache__,.next",
                str(self.repo_path)
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode != 0:
                return {
                    "error": f"SCC failed: {result.stderr}",
                    "success": False
                }
            
            # Parse results
            scc_data = json.loads(result.stdout)
            processed = self._process_scc_output(scc_data)
            
            self.logger.info(f"✅ Tech stack analysis completed")
            return {
                "repository_name": self.repo_path.name,
                "tool": "tech-stack-analyzer",
                "analysis_timestamp": datetime.now().isoformat(),
                "success": True,
                **processed
            }
            
        except Exception as e:
            self.logger.error(f"❌ Tech stack analysis failed: {e}")
            return {
                "error": str(e),
                "success": False
            }
    
    def _find_scc_command(self) -> Optional[str]:
        """Find SCC executable."""
        # Check bundled tools directory
        if self.scc_path and self.scc_path.exists():
            return str(self.scc_path)
        
        # Check system PATH
        if shutil.which("scc"):
            return "scc"
        
        # Check in tools directory relative to script
        script_dir = Path(__file__).parent if hasattr(sys, '_MEIPASS') else Path(sys.executable).parent
        tools_dir = script_dir / "tools"
        scc_exe = tools_dir / "scc.exe"
        if scc_exe.exists():
            return str(scc_exe)
        
        return None
    
    def _process_scc_output(self, scc_data: List[Dict]) -> Dict[str, Any]:
        """Process SCC output into structured format."""
        languages = {}
        total_lines = 0
        total_files = 0
        
        for lang_data in scc_data:
            lang = lang_data.get("Name", "Unknown")
            lines = lang_data.get("Lines", 0)
            code = lang_data.get("Code", 0)
            comments = lang_data.get("Comment", 0)
            blanks = lang_data.get("Blank", 0)
            files = lang_data.get("Count", 0)
            
            languages[lang] = {
                "files": files,
                "lines": lines,
                "code": code,
                "comments": comments,
                "blanks": blanks
            }
            
            total_lines += lines
            total_files += files
        
        # Calculate percentages
        for lang_name in languages:
            if total_lines > 0:
                languages[lang_name]["percentage"] = round(
                    (languages[lang_name]["lines"] / total_lines) * 100, 2
                )
        
        top_languages = sorted(
            languages.items(),
            key=lambda x: x[1]["lines"],
            reverse=True
        )[:10]
        
        return {
            "languages": languages,
            "totals": {
                "files": total_files,
                "lines": total_lines,
                "code": sum(l["code"] for l in languages.values()),
                "comments": sum(l["comments"] for l in languages.values())
            },
            "top_languages": top_languages
        }


class CodeQualityAnalyzer:
    """Analyze code quality using Lizard tool."""
    
    def __init__(self, repo_path: Path):
        self.repo_path = repo_path
        self.logger = logging.getLogger("standalone-analyzer")
    
    def analyze(self) -> Dict[str, Any]:
        """Run Lizard analysis on repository."""
        try:
            self.logger.info(f"🦎 Running code quality analysis...")
            
            # Check if Lizard is available
            if not shutil.which("lizard"):
                return {
                    "error": "Lizard tool not found. Please install: pip install lizard",
                    "success": False
                }
            
            # Run Lizard
            cmd = ["lizard", "--csv", str(self.repo_path)]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode != 0:
                return {
                    "error": f"Lizard failed: {result.stderr}",
                    "success": False
                }
            
            # Parse CSV output
            functions = self._parse_lizard_csv(result.stdout)
            summary = self._calculate_summary(functions)
            
            self.logger.info(f"✅ Code quality analysis completed")
            return {
                "repository_name": self.repo_path.name,
                "tool": "code-quality-analyzer",
                "analysis_timestamp": datetime.now().isoformat(),
                "success": True,
                "summary": summary,
                "high_complexity_functions": sorted(
                    [f for f in functions if f["cyclomatic_complexity"] > 10],
                    key=lambda x: x["cyclomatic_complexity"],
                    reverse=True
                )[:20]
            }
            
        except Exception as e:
            self.logger.error(f"❌ Code quality analysis failed: {e}")
            return {
                "error": str(e),
                "success": False
            }
    
    def _parse_lizard_csv(self, csv_output: str) -> List[Dict[str, Any]]:
        """Parse Lizard CSV output."""
        functions = []
        csv_reader = csv.reader(StringIO(csv_output))
        
        for row in csv_reader:
            if len(row) >= 10:
                try:
                    functions.append({
                        "nloc": int(row[0]),
                        "cyclomatic_complexity": int(row[1]),
                        "token_count": int(row[2]),
                        "parameter_count": int(row[3]),
                        "file": row[6],
                        "function_name": row[7]
                    })
                except (ValueError, IndexError):
                    continue
        
        return functions
    
    def _calculate_summary(self, functions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate summary statistics."""
        if not functions:
            return {
                "total_functions": 0,
                "average_complexity": 0,
                "max_complexity": 0
            }
        
        ccns = [f["cyclomatic_complexity"] for f in functions]
        
        return {
            "total_functions": len(functions),
            "average_complexity": round(sum(ccns) / len(ccns), 2),
            "max_complexity": max(ccns),
            "complexity_distribution": {
                "low": len([f for f in functions if f["cyclomatic_complexity"] <= 5]),
                "medium": len([f for f in functions if 5 < f["cyclomatic_complexity"] <= 10]),
                "high": len([f for f in functions if 10 < f["cyclomatic_complexity"] <= 20]),
                "very_high": len([f for f in functions if f["cyclomatic_complexity"] > 20])
            }
        }


class VulnerabilityAnalyzer:
    """Analyze vulnerabilities using Trivy tool."""
    
    def __init__(self, repo_path: Path, trivy_path: Optional[Path] = None):
        self.repo_path = repo_path
        self.trivy_path = trivy_path
        self.logger = logging.getLogger("standalone-analyzer")
    
    def analyze(self) -> Dict[str, Any]:
        """Run Trivy analysis on repository."""
        try:
            self.logger.info(f"🛡️ Running vulnerability analysis...")
            
            # Find Trivy executable
            trivy_cmd = self._find_trivy_command()
            if not trivy_cmd:
                return {
                    "error": "Trivy tool not found. Please install or provide path.",
                    "success": False
                }
            
            # Check for cached Trivy database
            script_dir = Path(__file__).parent if not hasattr(sys, '_MEIPASS') else Path(sys._MEIPASS)
            cache_dir = script_dir / "tools" / "trivy-cache"
            
            # Build Trivy command with cache support
            cmd = [
                trivy_cmd, "fs",
                "--scanners", "vuln",
                "-f", "json",
                "--exit-code", "0",
                "--timeout", "10m",
                "--quiet"
            ]
            
            # Use cached database if available (offline mode)
            if cache_dir.exists():
                cmd.extend(["--cache-dir", str(cache_dir)])
                cmd.append("--skip-db-update")  # Don't try to update DB online
                self.logger.info(f"📦 Using cached Trivy database from {cache_dir}")
            else:
                self.logger.info(f"⚠️  No cached database found, Trivy will download (may be slow)")
            
            cmd.append(str(self.repo_path))
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600
            )
            
            if result.returncode != 0:
                return {
                    "error": f"Trivy failed: {result.stderr}",
                    "success": False
                }
            
            # Parse results
            if not result.stdout.strip():
                trivy_data = {}
            else:
                trivy_data = json.loads(result.stdout)
            
            processed = self._process_trivy_output(trivy_data)
            
            self.logger.info(f"✅ Vulnerability analysis completed")
            return {
                "repository_name": self.repo_path.name,
                "tool": "vulnerability-analyzer",
                "analysis_timestamp": datetime.now().isoformat(),
                "success": True,
                **processed
            }
            
        except Exception as e:
            self.logger.error(f"❌ Vulnerability analysis failed: {e}")
            return {
                "error": str(e),
                "success": False
            }
    
    def _find_trivy_command(self) -> Optional[str]:
        """Find Trivy executable."""
        # Check bundled tools directory
        if self.trivy_path and self.trivy_path.exists():
            return str(self.trivy_path)
        
        # Check system PATH
        if shutil.which("trivy"):
            return "trivy"
        
        # Check in tools directory relative to script
        script_dir = Path(__file__).parent if not hasattr(sys, '_MEIPASS') else Path(sys._MEIPASS)
        tools_dir = script_dir / "tools"
        trivy_exe = tools_dir / "trivy.exe"
        if trivy_exe.exists():
            return str(trivy_exe)
        
        return None
    
    def _process_trivy_output(self, trivy_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process Trivy output into structured format."""
        vulnerabilities = []
        
        if "Results" in trivy_data:
            for result in trivy_data["Results"]:
                if "Vulnerabilities" in result:
                    vulnerabilities.extend(result["Vulnerabilities"])
        
        # Count by severity
        severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "UNKNOWN": 0}
        for vuln in vulnerabilities:
            severity = vuln.get("Severity", "UNKNOWN")
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        return {
            "scan_summary": {
                "total_vulnerabilities": len(vulnerabilities),
                "severity_counts": severity_counts
            },
            "vulnerabilities": [
                {
                    "id": v.get("VulnerabilityID"),
                    "package": v.get("PkgName"),
                    "severity": v.get("Severity"),
                    "title": v.get("Title", "")[:100]  # Truncate long titles
                }
                for v in vulnerabilities[:50]  # Limit to first 50
            ]
        }


class StandaloneAnalyzer:
    """Main standalone analyzer orchestrator."""
    
    def __init__(self, repo_path: Path, output_dir: Path, tools: Optional[List[str]] = None):
        self.repo_path = repo_path
        self.output_dir = output_dir
        self.tools = tools or ["history", "commits", "techstack", "quality", "vulnerabilities"]
        self.logger = setup_logging(output_dir / "analyzer.log")
        
        # Banner
        self.logger.info("=" * 70)
        self.logger.info(f"Git Repository Analyzer v{VERSION}")
        self.logger.info(f"Build Date: {BUILD_DATE}")
        self.logger.info("=" * 70)
        self.logger.info(f"Repository: {repo_path}")
        self.logger.info(f"Output: {output_dir}")
        self.logger.info(f"Tools: {', '.join(self.tools)}")
        self.logger.info("=" * 70)
    
    def run(self) -> bool:
        """Run all analysis tools."""
        try:
            # Validate repository
            if not self._validate_repository():
                return False
            
            # Create output directories
            self.output_dir.mkdir(parents=True, exist_ok=True)
            extractions_dir = self.output_dir / "extractions"
            extractions_dir.mkdir(exist_ok=True)
            
            # Count total steps
            total_steps = 2  # extraction + saving results
            if "history" in self.tools or "commits" in self.tools:
                total_steps += 1  # git log extraction
            if "history" in self.tools:
                total_steps += 1
            if "commits" in self.tools:
                total_steps += 1
            if "techstack" in self.tools:
                total_steps += 1
            if "quality" in self.tools:
                total_steps += 1
            if "vulnerabilities" in self.tools:
                total_steps += 1
            
            progress = ProgressTracker(total_steps)
            results = {}
            
            # Extract git logs
            if "history" in self.tools or "commits" in self.tools:
                progress.start_step("Extracting git logs")
                extractor = GitLogExtractor(self.repo_path, extractions_dir)
                
                if "history" in self.tools:
                    history_log = extractor.extract_repository_history()
                    if history_log:
                        progress.complete_step("Git log extraction", True)
                    else:
                        progress.complete_step("Git log extraction", False)
                        return False
                
                if "commits" in self.tools:
                    commits_log = extractor.extract_commit_analysis()
            
            # Run analyses
            if "history" in self.tools:
                progress.start_step("Repository history analysis")
                analyzer = RepositoryHistoryAnalyzer(history_log, self.repo_path.name)
                results["repository_history"] = analyzer.analyze()
                progress.complete_step("Repository history analysis", results["repository_history"].get("success", False))
            
            if "commits" in self.tools:
                progress.start_step("Commit classification analysis")
                analyzer = CommitClassificationAnalyzer(commits_log, self.repo_path.name)
                results["commit_classification"] = analyzer.analyze()
                progress.complete_step("Commit classification analysis", results["commit_classification"].get("success", False))
            
            if "techstack" in self.tools:
                progress.start_step("Tech stack analysis")
                analyzer = TechStackAnalyzer(self.repo_path)
                results["tech_stack"] = analyzer.analyze()
                progress.complete_step("Tech stack analysis", results["tech_stack"].get("success", False))
            
            if "quality" in self.tools:
                progress.start_step("Code quality analysis")
                analyzer = CodeQualityAnalyzer(self.repo_path)
                results["code_quality"] = analyzer.analyze()
                progress.complete_step("Code quality analysis", results["code_quality"].get("success", False))
            
            if "vulnerabilities" in self.tools:
                progress.start_step("Vulnerability analysis")
                analyzer = VulnerabilityAnalyzer(self.repo_path)
                results["vulnerabilities"] = analyzer.analyze()
                progress.complete_step("Vulnerability analysis", results["vulnerabilities"].get("success", False))
            
            # Save results
            progress.start_step("Saving results")
            self._save_results(results)
            progress.complete_step("Saving results", True)
            
            # Summary
            self.logger.info("=" * 70)
            self.logger.info("Analysis Complete!")
            self.logger.info(f"Results saved to: {self.output_dir}")
            self.logger.info("=" * 70)
            
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Analysis failed: {e}")
            return False
    
    def _validate_repository(self) -> bool:
        """Validate that the path is a git repository."""
        if not self.repo_path.exists():
            self.logger.error(f"❌ Repository path does not exist: {self.repo_path}")
            return False
        
        git_dir = self.repo_path / ".git"
        if not git_dir.exists():
            self.logger.error(f"❌ Not a git repository: {self.repo_path}")
            return False
        
        # Check if git is available
        if not shutil.which("git"):
            self.logger.error("❌ Git command not found in PATH")
            return False
        
        self.logger.info("✅ Repository validated")
        return True
    
    def _save_results(self, results: Dict[str, Any]):
        """Save analysis results as JSON files."""
        # Save individual tool results
        for tool_name, tool_results in results.items():
            output_file = self.output_dir / f"{tool_name}.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(tool_results, f, indent=2, ensure_ascii=False)
            self.logger.info(f"📄 Saved: {output_file}")
        
        # Save combined results
        combined_file = self.output_dir / "combined_results.json"
        combined = {
            "analysis_timestamp": datetime.now().isoformat(),
            "repository_name": self.repo_path.name,
            "repository_path": str(self.repo_path),
            "analyzer_version": VERSION,
            "results": results
        }
        
        with open(combined_file, 'w', encoding='utf-8') as f:
            json.dump(combined, f, indent=2, ensure_ascii=False)
        self.logger.info(f"📄 Saved combined results: {combined_file}")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Standalone Git Repository Analyzer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  analyzer.exe --repo C:\\path\\to\\cloned\\repo
  analyzer.exe --repo C:\\path\\to\\repo --output C:\\results
  analyzer.exe --repo C:\\path\\to\\repo --tools history,techstack,quality
        """
    )
    
    parser.add_argument(
        "--repo",
        required=True,
        type=Path,
        help="Path to the cloned git repository"
    )
    
    parser.add_argument(
        "--output",
        type=Path,
        help="Output directory for results (default: ./results/<repo_name>)"
    )
    
    parser.add_argument(
        "--tools",
        type=str,
        help="Comma-separated list of tools to run: history,commits,techstack,quality,vulnerabilities (default: all)"
    )
    
    parser.add_argument(
        "--version",
        action="version",
        version=f"Git Analyzer v{VERSION} ({BUILD_DATE})"
    )
    
    args = parser.parse_args()
    
    # Determine output directory
    if args.output:
        output_dir = args.output
    else:
        # Create results directory relative to script location, not current working directory
        script_dir = Path(__file__).parent if not hasattr(sys, '_MEIPASS') else Path.cwd()
        output_dir = script_dir / "results" / args.repo.name
    
    # Parse tools
    if args.tools:
        tools = [t.strip() for t in args.tools.split(",")]
    else:
        tools = None  # Use default (all)
    
    # Run analyzer
    analyzer = StandaloneAnalyzer(args.repo, output_dir, tools)
    success = analyzer.run()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

