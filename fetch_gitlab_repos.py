#!/usr/bin/env python3
"""
GitLab Repository Fetcher
Fetches all repositories from a GitLab group including subgroups
"""

import requests
import json
import sys
import urllib3

# Disable SSL warnings for self-signed certificates
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configuration
GITLAB_URL = "https://app.gitlab.barcapint.com"
GROUP_ID = "tmil"  # Can be group name or numeric ID
PRIVATE_TOKEN = "your_token_here"  # Replace with your actual token

def test_authentication(gitlab_url, token):
    """Test if the token is valid"""
    print("Testing authentication...")
    
    headers = {'PRIVATE-TOKEN': token}
    url = f"{gitlab_url}/api/v4/user"
    
    try:
        response = requests.get(url, headers=headers, verify=False, timeout=10)
        
        if response.status_code == 200:
            user = response.json()
            print(f"[OK] Authentication successful! Logged in as: {user.get('username', 'Unknown')}")
            return True
        elif response.status_code == 401:
            print("[ERROR] Authentication failed: Invalid or expired token")
            print("  Please generate a new Personal Access Token with 'read_api' scope")
            return False
        else:
            print(f"[ERROR] Unexpected response: {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Connection error: {e}")
        return False

def get_all_group_projects(gitlab_url, group_id, token):
    """Fetch all projects from a GitLab group including subgroups"""
    print(f"\nFetching projects from group '{group_id}'...")
    
    projects = []
    page = 1
    per_page = 100
    
    headers = {'PRIVATE-TOKEN': token}
    
    while True:
        url = f"{gitlab_url}/api/v4/groups/{group_id}/projects"
        params = {
            'include_subgroups': 'true',
            'per_page': per_page,
            'page': page,
            'archived': 'false',  # Exclude archived projects
            'simple': 'false'  # Get full project details
        }
        
        try:
            response = requests.get(url, params=params, headers=headers, verify=False, timeout=30)
            
            if response.status_code == 200:
                page_projects = response.json()
                
                if not page_projects:
                    break
                
                projects.extend(page_projects)
                print(f"  Page {page}: Found {len(page_projects)} projects (Total: {len(projects)})")
                
                # Check if there are more pages
                if len(page_projects) < per_page:
                    break
                
                page += 1
            elif response.status_code == 404:
                print(f"[ERROR] Group '{group_id}' not found")
                print("  Try using the numeric group ID instead")
                return None
            elif response.status_code == 401:
                print("[ERROR] Authentication failed")
                return None
            else:
                print(f"[ERROR] Error: {response.status_code}")
                print(f"  Response: {response.text[:200]}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Connection error: {e}")
            return None
    
    return projects

def save_results(projects):
    """Save projects to files"""
    if not projects:
        print("\nNo projects to save")
        return
    
    print(f"\n[OK] Total projects found: {len(projects)}")
    
    # Save URLs for the analyzer (one per line)
    with open('gitlab_repos.txt', 'w') as f:
        for project in projects:
            f.write(project['http_url_to_repo'] + '\n')
    
    # Save SSH URLs as alternative
    with open('gitlab_repos_ssh.txt', 'w') as f:
        for project in projects:
            f.write(project['ssh_url_to_repo'] + '\n')
    
    # Save detailed project info
    with open('gitlab_projects_details.json', 'w') as f:
        json.dump(projects, f, indent=2)
    
    # Save summary
    with open('gitlab_projects_summary.txt', 'w') as f:
        f.write(f"Total Projects: {len(projects)}\n")
        f.write("=" * 80 + "\n\n")
        for project in projects:
            f.write(f"Name: {project['name']}\n")
            f.write(f"Path: {project['path_with_namespace']}\n")
            f.write(f"URL:  {project['http_url_to_repo']}\n")
            f.write(f"Last Activity: {project.get('last_activity_at', 'N/A')}\n")
            f.write("-" * 80 + "\n")
    
    print("\n[OK] Files created:")
    print("  1. gitlab_repos.txt - HTTP URLs (for git clone)")
    print("  2. gitlab_repos_ssh.txt - SSH URLs (alternative)")
    print("  3. gitlab_projects_details.json - Full project details")
    print("  4. gitlab_projects_summary.txt - Human-readable summary")
    
    print("\nSample repositories (first 10):")
    for i, project in enumerate(projects[:10], 1):
        print(f"  {i:2}. {project['path_with_namespace']}")
        print(f"      {project['http_url_to_repo']}")

def main():
    print("=" * 80)
    print("GitLab Repository Fetcher")
    print("=" * 80)
    
    # Check if token is set
    if PRIVATE_TOKEN == "your_token_here":
        print("\n[ERROR] Please set your GitLab Personal Access Token")
        print("\nHow to get your token:")
        print("  1. Go to: https://app.gitlab.barcapint.com/-/profile/personal_access_tokens")
        print("  2. Create a new token with 'read_api' scope")
        print("  3. Copy the token")
        print("  4. Replace 'your_token_here' in this script with your token")
        print("\nAlternatively, run with token as argument:")
        print("  python3 fetch_gitlab_repos.py YOUR_TOKEN")
        sys.exit(1)
    
    # Allow token as command line argument
    if len(sys.argv) > 1:
        token = sys.argv[1]
        print("Using token from command line argument")
    else:
        token = PRIVATE_TOKEN
    
    # Test authentication first
    if not test_authentication(GITLAB_URL, token):
        print("\n[ERROR] Please fix authentication issues before continuing")
        sys.exit(1)
    
    # Fetch projects
    projects = get_all_group_projects(GITLAB_URL, GROUP_ID, token)
    
    if projects is None:
        print("\n[ERROR] Failed to fetch projects")
        sys.exit(1)
    
    # Save results
    save_results(projects)
    
    print("\n[OK] Done!")

if __name__ == "__main__":
    main()

