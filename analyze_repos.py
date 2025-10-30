#!/usr/bin/env python3
"""
Script to analyze GitLab repositories using SCC (Sloc Cloc and Code)
Reads a list of repository URLs from a text file, clones each repository,
runs scc analysis, and stores results in JSON format.
"""

import os
import sys
import json
import subprocess
import shutil
import tempfile
import argparse

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
    """Clone a GitLab repository"""
    print(f"  Cloning repository: {repo_url}")
    result = run_command(f"git clone --depth 1 {repo_url} {clone_dir}")
    return result is not None


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


def process_repository(repo_url, results_dir, temp_base_dir, scc_path):
    """Process a single repository: clone, analyze, and save results"""
    repo_name = extract_repo_name(repo_url)
    print(f"\nProcessing: {repo_name}")
    
    # Create a temporary directory for this specific repo
    temp_dir = tempfile.mkdtemp(dir=temp_base_dir, prefix=f"{repo_name}_")
    clone_path = os.path.join(temp_dir, repo_name)
    
    try:
        # Clone the repository
        if not clone_repository(repo_url, clone_path):
            print(f"  Failed to clone repository: {repo_url}")
            return False
        
        # Run SCC analysis
        scc_data = analyze_with_scc(clone_path, scc_path)
        if not scc_data:
            print(f"  Failed to analyze repository: {repo_name}")
            return False
        
        # Add metadata to the results
        results = {
            "repository_url": repo_url,
            "repository_name": repo_name,
            "analysis": scc_data
        }
        
        # Save results
        output_file = os.path.join(results_dir, f"{repo_name}_techStack.json")
        success = save_results(results, output_file)
        
        return success
        
    except Exception as e:
        print(f"  Error processing repository {repo_name}: {e}")
        return False
    finally:
        # Clean up cloned repository
        try:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
                print(f"  Cleaned up temporary files")
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
        description='Analyze GitLab repositories using SCC',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 analyze_repos.py repos.txt
  python3 analyze_repos.py repos.txt -o /path/to/results
  python3 analyze_repos.py repos.txt --scc-path /usr/local/bin/scc
  
Input file format (one repository URL per line):
  https://gitlab.com/user/repo1.git
  https://gitlab.com/user/repo2
  # This is a comment
  https://gitlab.com/user/repo3.git
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
    
    args = parser.parse_args()
    
    # Use the scc path from arguments or configuration
    scc_path = args.scc_path
    
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
    
    try:
        # Process each repository
        successful = 0
        failed = 0
        
        for repo_url in repositories:
            if process_repository(repo_url, results_dir, temp_base_dir, scc_path):
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

