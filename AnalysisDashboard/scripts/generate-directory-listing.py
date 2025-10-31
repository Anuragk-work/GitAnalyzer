#!/usr/bin/env python3
"""
Generate .directories.json file for AnalysisData folder
This file lists all repository folders to enable automatic discovery
"""
import json
import os
from pathlib import Path

def generate_directory_listing():
    """Generate .directories.json from AnalysisData folder structure"""
    # Get the project root directory (assuming script is in scripts/)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    analysis_data_dir = project_root / 'AnalysisData'
    
    if not analysis_data_dir.exists():
        print(f"❌ AnalysisData directory not found at: {analysis_data_dir}")
        return False
    
    # Find all subdirectories that contain commits.json
    repositories = []
    for item in analysis_data_dir.iterdir():
        if item.is_dir():
            commits_file = item / 'commits.json'
            if commits_file.exists():
                repositories.append(item.name)
                print(f"✅ Found repository: {item.name}")
    
    if not repositories:
        print("⚠️  No repositories found (folders with commits.json)")
        return False
    
    # Sort repositories for consistent output
    repositories.sort()
    
    # Write .directories.json
    output_file = analysis_data_dir / '.directories.json'
    output_data = {"directories": repositories}
    with open(output_file, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"\n✅ Generated {output_file}")
    print(f"   Found {len(repositories)} repository/repositories:")
    for repo in repositories:
        print(f"   - {repo}")
    
    return True

if __name__ == '__main__':
    print("🔍 Scanning AnalysisData folder for repositories...")
    success = generate_directory_listing()
    if success:
        print("\n✅ Directory listing generated successfully!")
        print("   The dashboard will now automatically discover repositories on first load.")
    else:
        print("\n❌ Failed to generate directory listing.")
        exit(1)

