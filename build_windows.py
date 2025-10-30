#!/usr/bin/env python3
"""
Standalone Git Analyzer - Python Build Script
Alternative to build_windows.bat for those who prefer Python
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

def print_header(text):
    """Print a section header."""
    print("\n" + "=" * 70)
    print(text)
    print("=" * 70)

def print_step(step, total, text):
    """Print a step."""
    print(f"\n[{step}/{total}] {text}")

def check_python():
    """Check Python version."""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 9):
        print("ERROR: Python 3.9 or later required")
        print(f"Current version: {version.major}.{version.minor}.{version.micro}")
        return False
    print(f"✅ Python {version.major}.{version.minor}.{version.micro} found")
    return True

def install_dependencies():
    """Install required Python packages."""
    print("Installing dependencies from requirements_standalone.txt...")
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", "requirements_standalone.txt"],
            check=True
        )
        print("✅ Dependencies installed")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        return False

def create_tools_dir():
    """Create tools directory."""
    tools_dir = Path("tools")
    tools_dir.mkdir(exist_ok=True)
    print(f"✅ Tools directory created: {tools_dir}")
    return tools_dir

def check_external_tools(tools_dir):
    """Check if external tools are present."""
    tools = {
        "scc.exe": "SCC (Code Counter)",
        "trivy.exe": "Trivy (Vulnerability Scanner)",
        "cm.jar": "CodeMaat (Evolution Analysis)"
    }
    
    missing = []
    for tool_file, tool_name in tools.items():
        tool_path = tools_dir / tool_file
        if tool_path.exists():
            print(f"✅ Found: {tool_name}")
        else:
            print(f"⚠️  Missing: {tool_name}")
            missing.append((tool_file, tool_name))
    
    if missing:
        print("\n" + "=" * 70)
        print("WARNING: Some external tools are missing!")
        print("=" * 70)
        print("\nPlease download and place in the tools/ directory:\n")
        
        if "scc.exe" in [m[0] for m in missing]:
            print("1. SCC (Code Counter):")
            print("   URL: https://github.com/boyter/scc/releases")
            print("   Download: scc-X.XX.X-x86_64-pc-windows.zip")
            print("   Extract scc.exe to: tools\\scc.exe\n")
        
        if "trivy.exe" in [m[0] for m in missing]:
            print("2. Trivy (Vulnerability Scanner):")
            print("   URL: https://github.com/aquasecurity/trivy/releases")
            print("   Download: trivy_X.XX.X_windows-64bit.zip")
            print("   Extract trivy.exe to: tools\\trivy.exe\n")
        
        if "cm.jar" in [m[0] for m in missing]:
            print("3. CodeMaat (Optional - Evolution Analysis):")
            print("   URL: https://github.com/adamtornhill/code-maat/releases")
            print("   Download: code-maat-X.X.X-standalone.jar")
            print("   Copy to: tools\\cm.jar")
            print("   Note: Requires Java Runtime Environment\n")
        
        print("=" * 70)
        response = input("\nContinue build anyway? (y/n): ")
        if response.lower() != 'y':
            return False
    
    return True

def build_executable():
    """Build executable with PyInstaller."""
    print("Building executable with PyInstaller...")
    try:
        subprocess.run(
            [sys.executable, "-m", "PyInstaller", "analyzer.spec"],
            check=True
        )
        print("✅ Build completed")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Build failed: {e}")
        return False

def create_distribution():
    """Create distribution package."""
    print("Creating distribution package...")
    
    # Create distribution directory
    dist_dir = Path("dist") / "git-analyzer"
    dist_dir.mkdir(parents=True, exist_ok=True)
    
    # Copy executable
    exe_source = Path("dist") / "analyzer.exe"
    if exe_source.exists():
        shutil.copy(exe_source, dist_dir / "analyzer.exe")
        print(f"✅ Copied analyzer.exe")
    else:
        print(f"❌ analyzer.exe not found at {exe_source}")
        return False
    
    # Copy tools if they exist
    tools_source = Path("tools")
    if tools_source.exists():
        tools_dest = dist_dir / "tools"
        tools_dest.mkdir(exist_ok=True)
        
        for tool in ["scc.exe", "trivy.exe", "cm.jar"]:
            tool_path = tools_source / tool
            if tool_path.exists():
                shutil.copy(tool_path, tools_dest / tool)
                print(f"✅ Copied {tool}")
    
    # Copy README
    readme_source = Path("README_STANDALONE.md")
    if readme_source.exists():
        shutil.copy(readme_source, dist_dir / "README.txt")
        print(f"✅ Copied README")
    
    # Create results directory
    results_dir = dist_dir / "results"
    results_dir.mkdir(exist_ok=True)
    with open(results_dir / "README.txt", 'w') as f:
        f.write("Results will be saved here\n")
    print(f"✅ Created results directory")
    
    return dist_dir

def main():
    """Main build process."""
    print_header("Standalone Git Analyzer - Build Script")
    
    # Step 1: Check Python
    print_step(1, 6, "Checking Python version")
    if not check_python():
        return 1
    
    # Step 2: Install dependencies
    print_step(2, 6, "Installing dependencies")
    if not install_dependencies():
        return 1
    
    # Step 3: Create tools directory
    print_step(3, 6, "Creating tools directory")
    tools_dir = create_tools_dir()
    
    # Step 4: Check external tools
    print_step(4, 6, "Checking external tools")
    if not check_external_tools(tools_dir):
        return 1
    
    # Step 5: Build executable
    print_step(5, 6, "Building executable with PyInstaller")
    if not build_executable():
        return 1
    
    # Step 6: Create distribution
    print_step(6, 6, "Creating distribution package")
    dist_dir = create_distribution()
    if not dist_dir:
        return 1
    
    # Success!
    print_header("Build Complete!")
    print(f"\n✅ Distribution package created in: {dist_dir}")
    print(f"\nPackage contents:")
    for item in sorted(dist_dir.rglob("*")):
        if item.is_file():
            rel_path = item.relative_to(dist_dir)
            print(f"   {rel_path}")
    
    print("\n" + "=" * 70)
    print("To test the analyzer:")
    print(f"   cd {dist_dir}")
    print(f"   analyzer.exe --repo C:\\path\\to\\git\\repo")
    print("\nTo distribute:")
    print("   1. Compress the git-analyzer folder to a ZIP file")
    print("   2. Distribute the ZIP file")
    print("   3. Users extract and run analyzer.exe")
    print("\nIMPORTANT: Users need Git installed on their system!")
    print("=" * 70)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())

