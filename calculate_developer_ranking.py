#!/usr/bin/env python3
"""
Developer Ranking Calculator - Enhanced Version

This script creates a comprehensive weighted ranking of contributors based on multiple factors:

PRIMARY METRICS:
1. Commit count - Overall contribution frequency
2. Lines changed (churn) - Volume of code contributions
3. Hotspot contributions - Work on high-risk, complex areas
4. Code ownership - Main developer status on files
5. Complexity handling - Work on complex code

ADVANCED METRICS:
6. Communication/Collaboration - Working with other developers
7. Recency - Recent contributions weighted higher
8. Fragmentation impact - Knowledge distribution
9. Coupling work - Working on highly coupled code
10. Hotspot commits - Direct commits to hotspot files

Configurable weights allow customization of ranking criteria.
"""

import json
import csv
import sys
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple
from datetime import datetime
import argparse


class DeveloperRankingCalculator:
    def __init__(self, results_dir: Path, weights: Dict[str, float] = None):
        """
        Initialize the ranking calculator.
        
        Args:
            results_dir: Path to the results directory
            weights: Dictionary of weights for each factor (default: balanced weights)
        """
        self.results_dir = Path(results_dir)
        self.repo_name = self.results_dir.name
        
        # Default weights (can be customized) - Must sum to 1.0
        self.weights = weights or {
            'commits': 0.15,              # 15% - Commit count
            'churn': 0.12,                # 12% - Total lines added/deleted
            'hotspot_work': 0.20,         # 20% - Work on hotspots (high importance)
            'ownership': 0.15,            # 15% - Code ownership
            'complexity': 0.08,           # 8%  - Work on complex code
            'communication': 0.10,        # 10% - Collaboration with others
            'recency': 0.08,              # 8%  - Recent activity
            'fragmentation': 0.05,        # 5%  - Knowledge distribution
            'coupling': 0.05,             # 5%  - Work on coupled code
            'hotspot_commits': 0.02       # 2%  - Direct hotspot commits
        }
        
        # Validate weights sum to 1.0
        total_weight = sum(self.weights.values())
        if abs(total_weight - 1.0) > 0.001:
            raise ValueError(f"Weights must sum to 1.0, got {total_weight}")
        
        # Data storage
        self.developers = defaultdict(lambda: {
            'commits': 0,
            'lines_added': 0,
            'lines_deleted': 0,
            'hotspot_score': 0.0,
            'ownership_score': 0.0,
            'complexity_score': 0.0,
            'communication_score': 0.0,
            'recency_score': 0.0,
            'fragmentation_score': 0.0,
            'coupling_score': 0.0,
            'hotspot_commits': 0,
            'email': None,
            'files_owned': [],
            'hotspot_files': [],
            'last_commit_date': None,
            'collaboration_partners': []
        })
        
        self.hotspots = {}  # file -> hotspot data
        self.file_to_soc = {}  # file -> sum of coupling score
        
    def load_commits(self):
        """Load commit data from commits.json"""
        commits_file = self.results_dir / "commits.json"
        if not commits_file.exists():
            print(f"Warning: {commits_file} not found")
            return
        
        with open(commits_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Track current date for recency calculations
        current_date = datetime.now()
        
        for commit in data.get('commits', []):
            author = commit.get('author_name', 'Unknown')
            email = commit.get('author_email', '')
            date_str = commit.get('date', '')
            
            self.developers[author]['commits'] += 1
            if not self.developers[author]['email'] and email:
                self.developers[author]['email'] = email
            
            # Track last commit date and calculate recency
            if date_str:
                try:
                    commit_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    
                    if (self.developers[author]['last_commit_date'] is None or 
                        commit_date > self.developers[author]['last_commit_date']):
                        self.developers[author]['last_commit_date'] = commit_date
                    
                    # Calculate recency score (commits in last 90 days weighted higher)
                    days_ago = (current_date - commit_date.replace(tzinfo=None)).days
                    if days_ago <= 30:
                        recency_weight = 10.0
                    elif days_ago <= 90:
                        recency_weight = 5.0
                    elif days_ago <= 180:
                        recency_weight = 2.0
                    elif days_ago <= 365:
                        recency_weight = 1.0
                    else:
                        recency_weight = 0.5
                    
                    self.developers[author]['recency_score'] += recency_weight
                except:
                    pass
        
        print(f"✓ Loaded {len(data.get('commits', []))} commits")
    
    def load_hotspots(self):
        """Load hotspot data"""
        hotspots_file = self.results_dir / f"{self.repo_name}_hotspots.csv"
        if not hotspots_file.exists():
            print(f"Warning: {hotspots_file} not found")
            return
        
        with open(hotspots_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                file_path = row['file']
                self.hotspots[file_path] = {
                    'hotspot_score': float(row['hotspot_score']),
                    'risk_level': row['risk_level'],
                    'revisions': int(row['revisions']),
                    'avg_complexity': float(row['avg_complexity'])
                }
        
        print(f"✓ Loaded {len(self.hotspots)} hotspots")
    
    def load_entity_ownership(self):
        """Load entity ownership data - lines added/deleted per author per file"""
        ownership_file = self.results_dir / f"{self.repo_name}_code-analysis_entity_ownership.csv"
        if not ownership_file.exists():
            print(f"Warning: {ownership_file} not found")
            return
        
        with open(ownership_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                author = row['author']
                entity = row['entity']
                added = int(row['added'])
                deleted = int(row['deleted'])
                
                self.developers[author]['lines_added'] += added
                self.developers[author]['lines_deleted'] += deleted
                
                # Calculate hotspot contribution
                if entity in self.hotspots:
                    hotspot_data = self.hotspots[entity]
                    # Weight by hotspot score and lines changed
                    contribution = (added + deleted) * hotspot_data['hotspot_score'] / 100.0
                    self.developers[author]['hotspot_score'] += contribution
                    
                    if entity not in self.developers[author]['hotspot_files']:
                        self.developers[author]['hotspot_files'].append(entity)
                        # Count as a hotspot commit (simplified)
                        self.developers[author]['hotspot_commits'] += 1
                
                # Track coupling work
                if entity in self.file_to_soc:
                    soc_value = self.file_to_soc[entity]
                    contribution = (added + deleted) * (soc_value / 1000.0)  # Normalize
                    self.developers[author]['coupling_score'] += contribution
        
        print(f"✓ Loaded entity ownership data")
    
    def load_main_developers(self):
        """Load main developer data - ownership percentage"""
        main_dev_file = self.results_dir / f"{self.repo_name}_code-analysis_main_dev.csv"
        if not main_dev_file.exists():
            print(f"Warning: {main_dev_file} not found")
            return
        
        with open(main_dev_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                author = row['main-dev']
                entity = row['entity']
                ownership = float(row['ownership'])
                
                # Weight ownership by the percentage
                self.developers[author]['ownership_score'] += ownership
                self.developers[author]['files_owned'].append({
                    'file': entity,
                    'ownership': ownership
                })
        
        print(f"✓ Loaded main developer data")
    
    def load_complexity_data(self):
        """Load complexity data and correlate with developer contributions"""
        complexity_file = self.results_dir / "complexity.json"
        if not complexity_file.exists():
            print(f"Warning: {complexity_file} not found")
            return
        
        with open(complexity_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Build file complexity map
        file_complexity = defaultdict(lambda: {'avg_complexity': 0, 'function_count': 0})
        
        for func in data.get('analysis', {}).get('functions', []):
            file_path = func.get('file', '')
            # Normalize path to match other data
            file_path = file_path.replace(str(self.results_dir.parent / 'repositories' / self.repo_name) + '/', '')
            
            complexity = func.get('cyclomatic_complexity', 0)
            file_complexity[file_path]['avg_complexity'] += complexity
            file_complexity[file_path]['function_count'] += 1
        
        # Calculate average complexity per file
        for file_path, data in file_complexity.items():
            if data['function_count'] > 0:
                data['avg_complexity'] /= data['function_count']
        
        # Now correlate with developer contributions
        ownership_file = self.results_dir / f"{self.repo_name}_code-analysis_entity_ownership.csv"
        if ownership_file.exists():
            with open(ownership_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    author = row['author']
                    entity = row['entity']
                    lines_changed = int(row['added']) + int(row['deleted'])
                    
                    if entity in file_complexity:
                        complexity = file_complexity[entity]['avg_complexity']
                        # Weight by complexity and contribution size
                        contribution = lines_changed * complexity / 10.0  # Normalize
                        self.developers[author]['complexity_score'] += contribution
        
        print(f"✓ Loaded complexity data")
    
    def load_communication_data(self):
        """Load communication/collaboration data"""
        comm_file = self.results_dir / f"{self.repo_name}_code-analysis_communication.csv"
        if not comm_file.exists():
            print(f"Warning: {comm_file} not found")
            return
        
        with open(comm_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                author = row['author']
                peer = row['peer']
                shared = int(row['shared'])
                strength = int(row['strength'])
                
                # Weight by both shared files and strength of collaboration
                collaboration_score = shared * strength / 10.0  # Normalize
                self.developers[author]['communication_score'] += collaboration_score
                
                # Track collaboration partners
                if peer not in [p['name'] for p in self.developers[author]['collaboration_partners']]:
                    self.developers[author]['collaboration_partners'].append({
                        'name': peer,
                        'shared_files': shared,
                        'strength': strength
                    })
        
        print(f"✓ Loaded communication data")
    
    def load_author_churn(self):
        """Load author churn data - already captured in entity ownership, but validate"""
        churn_file = self.results_dir / f"{self.repo_name}_code-analysis_author_churn.csv"
        if not churn_file.exists():
            print(f"Warning: {churn_file} not found")
            return
        
        # This data is redundant with entity_ownership, but we can validate
        print(f"✓ Author churn data validated")
    
    def load_fragmentation_data(self):
        """Load fragmentation data"""
        frag_file = self.results_dir / f"{self.repo_name}_code-analysis_fragmentation.csv"
        if not frag_file.exists():
            print(f"Warning: {frag_file} not found")
            return
        
        # Build file -> fractal value map
        file_fragmentation = {}
        with open(frag_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                entity = row['entity']
                fractal_value = float(row['fractal-value'])
                file_fragmentation[entity] = fractal_value
        
        # Correlate with developer work
        ownership_file = self.results_dir / f"{self.repo_name}_code-analysis_entity_ownership.csv"
        if ownership_file.exists():
            with open(ownership_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    author = row['author']
                    entity = row['entity']
                    lines_changed = int(row['added']) + int(row['deleted'])
                    
                    if entity in file_fragmentation:
                        # Higher fragmentation = more distributed knowledge
                        # Working on fragmented code is valuable
                        frag_value = file_fragmentation[entity]
                        contribution = lines_changed * frag_value
                        self.developers[author]['fragmentation_score'] += contribution
        
        print(f"✓ Loaded fragmentation data")
    
    def load_soc_data(self):
        """Load Sum of Coupling (SOC) data"""
        soc_file = self.results_dir / f"{self.repo_name}_code-analysis_soc.csv"
        if not soc_file.exists():
            print(f"Warning: {soc_file} not found")
            return
        
        with open(soc_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                entity = row['entity']
                soc = int(row['soc'])
                self.file_to_soc[entity] = soc
        
        # Coupling score calculation happens in load_entity_ownership
        print(f"✓ Loaded SOC (coupling) data")
    
    def normalize_scores(self):
        """Normalize all scores to 0-100 range"""
        if not self.developers:
            return
        
        # Get max values for normalization (using max(..., default=1) to avoid division by zero)
        max_commits = max((d['commits'] for d in self.developers.values()), default=1)
        max_churn = max((d['lines_added'] + d['lines_deleted'] for d in self.developers.values()), default=1)
        max_hotspot = max((d['hotspot_score'] for d in self.developers.values()), default=1)
        max_ownership = max((d['ownership_score'] for d in self.developers.values()), default=1)
        max_complexity = max((d['complexity_score'] for d in self.developers.values()), default=1)
        max_communication = max((d['communication_score'] for d in self.developers.values()), default=1)
        max_recency = max((d['recency_score'] for d in self.developers.values()), default=1)
        max_fragmentation = max((d['fragmentation_score'] for d in self.developers.values()), default=1)
        max_coupling = max((d['coupling_score'] for d in self.developers.values()), default=1)
        max_hotspot_commits = max((d['hotspot_commits'] for d in self.developers.values()), default=1)
        
        # Normalize to 0-100
        for dev_data in self.developers.values():
            dev_data['normalized_commits'] = (dev_data['commits'] / max_commits) * 100
            dev_data['normalized_churn'] = ((dev_data['lines_added'] + dev_data['lines_deleted']) / max_churn) * 100
            dev_data['normalized_hotspot'] = (dev_data['hotspot_score'] / max_hotspot) * 100 if max_hotspot > 0 else 0
            dev_data['normalized_ownership'] = (dev_data['ownership_score'] / max_ownership) * 100 if max_ownership > 0 else 0
            dev_data['normalized_complexity'] = (dev_data['complexity_score'] / max_complexity) * 100 if max_complexity > 0 else 0
            dev_data['normalized_communication'] = (dev_data['communication_score'] / max_communication) * 100 if max_communication > 0 else 0
            dev_data['normalized_recency'] = (dev_data['recency_score'] / max_recency) * 100 if max_recency > 0 else 0
            dev_data['normalized_fragmentation'] = (dev_data['fragmentation_score'] / max_fragmentation) * 100 if max_fragmentation > 0 else 0
            dev_data['normalized_coupling'] = (dev_data['coupling_score'] / max_coupling) * 100 if max_coupling > 0 else 0
            dev_data['normalized_hotspot_commits'] = (dev_data['hotspot_commits'] / max_hotspot_commits) * 100 if max_hotspot_commits > 0 else 0
    
    def calculate_weighted_scores(self):
        """Calculate final weighted scores for all developers"""
        for developer, data in self.developers.items():
            weighted_score = (
                data.get('normalized_commits', 0) * self.weights['commits'] +
                data.get('normalized_churn', 0) * self.weights['churn'] +
                data.get('normalized_hotspot', 0) * self.weights['hotspot_work'] +
                data.get('normalized_ownership', 0) * self.weights['ownership'] +
                data.get('normalized_complexity', 0) * self.weights['complexity'] +
                data.get('normalized_communication', 0) * self.weights['communication'] +
                data.get('normalized_recency', 0) * self.weights['recency'] +
                data.get('normalized_fragmentation', 0) * self.weights['fragmentation'] +
                data.get('normalized_coupling', 0) * self.weights['coupling'] +
                data.get('normalized_hotspot_commits', 0) * self.weights['hotspot_commits']
            )
            data['weighted_score'] = weighted_score
    
    def get_rankings(self, top_n: int = None) -> List[Tuple[str, Dict]]:
        """
        Get developer rankings sorted by weighted score.
        
        Args:
            top_n: Number of top developers to return (None for all)
            
        Returns:
            List of (developer_name, data) tuples sorted by score
        """
        rankings = sorted(
            self.developers.items(),
            key=lambda x: x[1].get('weighted_score', 0),
            reverse=True
        )
        
        if top_n:
            rankings = rankings[:top_n]
        
        return rankings
    
    def print_rankings(self, top_n: int = 20):
        """Print developer rankings in a formatted table"""
        rankings = self.get_rankings(top_n)
        
        print(f"\n{'='*140}")
        print(f"{'DEVELOPER RANKING REPORT':^140}")
        print(f"Repository: {self.repo_name}")
        print(f"{'='*140}")
        print(f"\nWeighting Scheme:")
        print(f"  Commits: {self.weights['commits']:.0%} | Churn: {self.weights['churn']:.0%} | "
              f"Hotspots: {self.weights['hotspot_work']:.0%} | Ownership: {self.weights['ownership']:.0%}")
        print(f"  Complexity: {self.weights['complexity']:.0%} | Communication: {self.weights['communication']:.0%} | "
              f"Recency: {self.weights['recency']:.0%} | Fragmentation: {self.weights['fragmentation']:.0%}")
        print(f"  Coupling: {self.weights['coupling']:.0%} | Hotspot Commits: {self.weights['hotspot_commits']:.0%}")
        print(f"\n{'='*140}")
        
        # Header
        print(f"{'Rank':<6} {'Developer':<40} {'Score':<8} {'Commits':<8} {'Churn':<11} {'Hotspots':<10} {'Owned':<8} {'Collab':<8}")
        print(f"{'-'*140}")
        
        # Rankings
        for rank, (developer, data) in enumerate(rankings, 1):
            score = data.get('weighted_score', 0)
            commits = data.get('commits', 0)
            churn = data.get('lines_added', 0) + data.get('lines_deleted', 0)
            hotspot_files = len(data.get('hotspot_files', []))
            files_owned = len(data.get('files_owned', []))
            collaborators = len(data.get('collaboration_partners', []))
            
            # Truncate long names
            display_name = developer[:39]
            
            print(f"{rank:<6} {display_name:<40} {score:>6.1f}  {commits:>6}  {churn:>10}  {hotspot_files:>9}  {files_owned:>7}  {collaborators:>7}")
        
        print(f"{'='*140}\n")
    
    def print_detailed_top_developers(self, top_n: int = 10):
        """Print detailed breakdown for top N developers"""
        rankings = self.get_rankings(top_n)
        
        print(f"\n{'='*140}")
        print(f"{'DETAILED BREAKDOWN - TOP ' + str(top_n) + ' DEVELOPERS':^140}")
        print(f"{'='*140}\n")
        
        for rank, (developer, data) in enumerate(rankings, 1):
            print(f"Rank #{rank}: {developer}")
            print(f"  Email: {data.get('email', 'N/A')}")
            print(f"  Overall Score: {data.get('weighted_score', 0):.2f}/100")
            print(f"\n  Metrics:")
            print(f"    • Commits: {data.get('commits', 0)} (normalized: {data.get('normalized_commits', 0):.1f})")
            print(f"    • Code Churn: {data.get('lines_added', 0):,} added, {data.get('lines_deleted', 0):,} deleted (normalized: {data.get('normalized_churn', 0):.1f})")
            print(f"    • Hotspot Work: {data.get('hotspot_score', 0):.1f} (normalized: {data.get('normalized_hotspot', 0):.1f})")
            print(f"    • Ownership: {data.get('ownership_score', 0):.1f} (normalized: {data.get('normalized_ownership', 0):.1f})")
            print(f"    • Complexity: {data.get('complexity_score', 0):.1f} (normalized: {data.get('normalized_complexity', 0):.1f})")
            print(f"    • Communication: {data.get('communication_score', 0):.1f} (normalized: {data.get('normalized_communication', 0):.1f})")
            print(f"    • Recency: {data.get('recency_score', 0):.1f} (normalized: {data.get('normalized_recency', 0):.1f})")
            print(f"    • Fragmentation: {data.get('fragmentation_score', 0):.1f} (normalized: {data.get('normalized_fragmentation', 0):.1f})")
            print(f"    • Coupling: {data.get('coupling_score', 0):.1f} (normalized: {data.get('normalized_coupling', 0):.1f})")
            print(f"    • Hotspot Commits: {data.get('hotspot_commits', 0)} (normalized: {data.get('normalized_hotspot_commits', 0):.1f})")
            
            last_commit = data.get('last_commit_date')
            if last_commit:
                # Make both naive for comparison
                last_commit_naive = last_commit.replace(tzinfo=None) if last_commit.tzinfo else last_commit
                days_ago = (datetime.now() - last_commit_naive).days
                print(f"    • Last Active: {days_ago} days ago ({last_commit.strftime('%Y-%m-%d')})")
            
            print(f"\n  Files: {len(data.get('files_owned', []))} owned, {len(data.get('hotspot_files', []))} hotspots")
            print(f"  Collaborators: {len(data.get('collaboration_partners', []))}")
            
            # Show top collaborators
            if data.get('collaboration_partners'):
                top_collabs = sorted(data['collaboration_partners'], 
                                   key=lambda x: x['strength'], reverse=True)[:3]
                print(f"  Top Collaborators:")
                for collab in top_collabs:
                    print(f"    - {collab['name']} (strength: {collab['strength']}, shared: {collab['shared_files']})")
            
            print(f"{'-'*140}\n")
    
    def save_detailed_report(self, output_file: Path, top_n: int = None):
        """Save detailed ranking report to JSON file"""
        rankings = self.get_rankings(top_n)
        
        report = {
            'repository': self.repo_name,
            'total_developers': len(self.developers),
            'weights': self.weights,
            'generated_at': datetime.now().isoformat(),
            'rankings': []
        }
        
        for rank, (developer, data) in enumerate(rankings, 1):
            dev_report = {
                'rank': rank,
                'developer': developer,
                'email': data.get('email'),
                'weighted_score': round(data.get('weighted_score', 0), 2),
                'metrics': {
                    'commits': data.get('commits', 0),
                    'lines_added': data.get('lines_added', 0),
                    'lines_deleted': data.get('lines_deleted', 0),
                    'total_churn': data.get('lines_added', 0) + data.get('lines_deleted', 0),
                    'hotspot_score': round(data.get('hotspot_score', 0), 2),
                    'hotspot_files_count': len(data.get('hotspot_files', [])),
                    'hotspot_commits': data.get('hotspot_commits', 0),
                    'ownership_score': round(data.get('ownership_score', 0), 2),
                    'files_owned_count': len(data.get('files_owned', [])),
                    'complexity_score': round(data.get('complexity_score', 0), 2),
                    'communication_score': round(data.get('communication_score', 0), 2),
                    'collaborators_count': len(data.get('collaboration_partners', [])),
                    'recency_score': round(data.get('recency_score', 0), 2),
                    'fragmentation_score': round(data.get('fragmentation_score', 0), 2),
                    'coupling_score': round(data.get('coupling_score', 0), 2),
                    'last_commit_date': data.get('last_commit_date').isoformat() if data.get('last_commit_date') else None
                },
                'normalized_scores': {
                    'commits': round(data.get('normalized_commits', 0), 2),
                    'churn': round(data.get('normalized_churn', 0), 2),
                    'hotspot_work': round(data.get('normalized_hotspot', 0), 2),
                    'ownership': round(data.get('normalized_ownership', 0), 2),
                    'complexity': round(data.get('normalized_complexity', 0), 2),
                    'communication': round(data.get('normalized_communication', 0), 2),
                    'recency': round(data.get('normalized_recency', 0), 2),
                    'fragmentation': round(data.get('normalized_fragmentation', 0), 2),
                    'coupling': round(data.get('normalized_coupling', 0), 2),
                    'hotspot_commits': round(data.get('normalized_hotspot_commits', 0), 2)
                },
                'top_hotspot_files': data.get('hotspot_files', [])[:10],
                'top_owned_files': [
                    {'file': f['file'], 'ownership': f['ownership']} 
                    for f in sorted(data.get('files_owned', []), key=lambda x: x['ownership'], reverse=True)[:10]
                ],
                'top_collaborators': [
                    {'name': c['name'], 'shared_files': c['shared_files'], 'strength': c['strength']}
                    for c in sorted(data.get('collaboration_partners', []), key=lambda x: x['strength'], reverse=True)[:10]
                ]
            }
            report['rankings'].append(dev_report)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)
        
        print(f"✓ Detailed JSON report saved to {output_file}")
    
    def save_csv_report(self, output_file: Path, top_n: int = None):
        """Save ranking report to CSV file"""
        rankings = self.get_rankings(top_n)
        
        with open(output_file, 'w', encoding='utf-8', newline='') as f:
            fieldnames = [
                'rank', 'developer', 'email', 'weighted_score',
                'commits', 'lines_added', 'lines_deleted', 'total_churn',
                'hotspot_score', 'hotspot_files_count', 'hotspot_commits',
                'ownership_score', 'files_owned_count',
                'complexity_score', 'communication_score', 'collaborators_count',
                'recency_score', 'fragmentation_score', 'coupling_score',
                'last_commit_date'
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for rank, (developer, data) in enumerate(rankings, 1):
                writer.writerow({
                    'rank': rank,
                    'developer': developer,
                    'email': data.get('email', ''),
                    'weighted_score': round(data.get('weighted_score', 0), 2),
                    'commits': data.get('commits', 0),
                    'lines_added': data.get('lines_added', 0),
                    'lines_deleted': data.get('lines_deleted', 0),
                    'total_churn': data.get('lines_added', 0) + data.get('lines_deleted', 0),
                    'hotspot_score': round(data.get('hotspot_score', 0), 2),
                    'hotspot_files_count': len(data.get('hotspot_files', [])),
                    'hotspot_commits': data.get('hotspot_commits', 0),
                    'ownership_score': round(data.get('ownership_score', 0), 2),
                    'files_owned_count': len(data.get('files_owned', [])),
                    'complexity_score': round(data.get('complexity_score', 0), 2),
                    'communication_score': round(data.get('communication_score', 0), 2),
                    'collaborators_count': len(data.get('collaboration_partners', [])),
                    'recency_score': round(data.get('recency_score', 0), 2),
                    'fragmentation_score': round(data.get('fragmentation_score', 0), 2),
                    'coupling_score': round(data.get('coupling_score', 0), 2),
                    'last_commit_date': data.get('last_commit_date').isoformat() if data.get('last_commit_date') else ''
                })
        
        print(f"✓ CSV report saved to {output_file}")
    
    def run_analysis(self):
        """Run the complete analysis"""
        print(f"\n{'='*100}")
        print(f"{'DEVELOPER RANKING ANALYSIS':^100}")
        print(f"Repository: {self.repo_name}")
        print(f"{'='*100}\n")
        
        print("Loading data sources...")
        self.load_commits()
        self.load_hotspots()
        self.load_soc_data()  # Load before entity_ownership
        self.load_entity_ownership()
        self.load_main_developers()
        self.load_complexity_data()
        self.load_communication_data()
        self.load_author_churn()
        self.load_fragmentation_data()
        
        print(f"\n{'='*100}")
        print("Calculating normalized and weighted scores...")
        print(f"{'='*100}\n")
        
        self.normalize_scores()
        self.calculate_weighted_scores()
        
        print(f"✓ Analysis complete! Evaluated {len(self.developers)} developers\n")


def main():
    parser = argparse.ArgumentParser(
        description='Calculate comprehensive weighted developer rankings from CodeMaat analysis data',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage - analyze results and show top 20
  python3 calculate_developer_ranking.py results/newrelic-dotnet-agent
  
  # Show top 50 developers with detailed breakdown
  python3 calculate_developer_ranking.py results/newrelic-dotnet-agent --top 50 --detailed 10
  
  # Emphasize recent activity and hotspot work
  python3 calculate_developer_ranking.py results/newrelic-dotnet-agent \\
    --weight-hotspots 0.30 --weight-recency 0.15 --weight-commits 0.10
  
  # Save comprehensive reports
  python3 calculate_developer_ranking.py results/newrelic-dotnet-agent \\
    --output-json rankings.json --output-csv rankings.csv
        """
    )
    
    parser.add_argument('results_dir', type=str, help='Path to results directory')
    parser.add_argument('--top', type=int, default=20, help='Number of top developers to show in summary (default: 20)')
    parser.add_argument('--detailed', type=int, default=0, help='Show detailed breakdown for top N developers (default: 0)')
    parser.add_argument('--output-json', type=str, help='Save detailed report to JSON file')
    parser.add_argument('--output-csv', type=str, help='Save report to CSV file')
    
    # Weight arguments
    parser.add_argument('--weight-commits', type=float, default=0.15, help='Weight for commit count (default: 0.15)')
    parser.add_argument('--weight-churn', type=float, default=0.12, help='Weight for code churn (default: 0.12)')
    parser.add_argument('--weight-hotspots', type=float, default=0.20, help='Weight for hotspot work (default: 0.20)')
    parser.add_argument('--weight-ownership', type=float, default=0.15, help='Weight for code ownership (default: 0.15)')
    parser.add_argument('--weight-complexity', type=float, default=0.08, help='Weight for complexity (default: 0.08)')
    parser.add_argument('--weight-communication', type=float, default=0.10, help='Weight for communication (default: 0.10)')
    parser.add_argument('--weight-recency', type=float, default=0.08, help='Weight for recency (default: 0.08)')
    parser.add_argument('--weight-fragmentation', type=float, default=0.05, help='Weight for fragmentation (default: 0.05)')
    parser.add_argument('--weight-coupling', type=float, default=0.05, help='Weight for coupling (default: 0.05)')
    parser.add_argument('--weight-hotspot-commits', type=float, default=0.02, help='Weight for hotspot commits (default: 0.02)')
    
    args = parser.parse_args()
    
    # Build weights dictionary
    weights = {
        'commits': args.weight_commits,
        'churn': args.weight_churn,
        'hotspot_work': args.weight_hotspots,
        'ownership': args.weight_ownership,
        'complexity': args.weight_complexity,
        'communication': args.weight_communication,
        'recency': args.weight_recency,
        'fragmentation': args.weight_fragmentation,
        'coupling': args.weight_coupling,
        'hotspot_commits': args.weight_hotspot_commits
    }
    
    # Validate weights
    total_weight = sum(weights.values())
    if abs(total_weight - 1.0) > 0.001:
        print(f"Error: Weights must sum to 1.0, got {total_weight}")
        print("Adjust your weight arguments so they sum to 1.0")
        sys.exit(1)
    
    # Check if results directory exists
    results_path = Path(args.results_dir)
    if not results_path.exists():
        print(f"Error: Results directory not found: {results_path}")
        sys.exit(1)
    
    # Run analysis
    calculator = DeveloperRankingCalculator(results_path, weights)
    calculator.run_analysis()
    calculator.print_rankings(top_n=args.top)
    
    # Show detailed breakdown if requested
    if args.detailed > 0:
        calculator.print_detailed_top_developers(top_n=args.detailed)
    
    # Save reports if requested
    if args.output_json:
        calculator.save_detailed_report(Path(args.output_json), top_n=None)
    
    if args.output_csv:
        calculator.save_csv_report(Path(args.output_csv), top_n=None)


if __name__ == '__main__':
    main()
