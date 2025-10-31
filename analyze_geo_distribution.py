#!/usr/bin/env python3
"""
Analyze geographic distribution of commits based on timezone information.
Reads commits.json files and generates geographic_distribution.json with location data.
"""

import json
import os
import sys
from collections import defaultdict
from datetime import datetime
import re


# Mapping of UTC offsets to geographic regions/cities
# Format: "offset_hours" -> {"region": "", "cities": [], "countries": []}
TIMEZONE_TO_LOCATION = {
    "-12": {"region": "Pacific/Baker Island", "cities": ["Baker Island"], "countries": []},
    "-11": {"region": "Pacific/Samoa", "cities": ["Pago Pago"], "countries": ["American Samoa", "Samoa"]},
    "-10": {"region": "Pacific/Honolulu", "cities": ["Honolulu"], "countries": ["USA (Hawaii)"]},
    "-9": {"region": "America/Anchorage", "cities": ["Anchorage"], "countries": ["USA (Alaska)"]},
    "-8": {"region": "America/Los_Angeles", "cities": ["Los Angeles", "San Francisco", "Seattle", "Vancouver"], "countries": ["USA (West Coast)", "Canada (BC)"]},
    "-7": {"region": "America/Denver", "cities": ["Denver", "Phoenix", "Calgary"], "countries": ["USA (Mountain)", "Canada (Alberta)", "Mexico (Sonora)"]},
    "-6": {"region": "America/Chicago", "cities": ["Chicago", "Houston", "Mexico City"], "countries": ["USA (Central)", "Canada (Manitoba)", "Mexico", "Central America"]},
    "-5": {"region": "America/New_York", "cities": ["New York", "Toronto", "Miami", "Boston"], "countries": ["USA (East Coast)", "Canada (Ontario)", "Colombia", "Peru"]},
    "-4": {"region": "America/Halifax", "cities": ["Halifax", "Caracas", "Santiago"], "countries": ["Canada (Atlantic)", "Venezuela", "Chile", "Bolivia"]},
    "-3.5": {"region": "America/St_Johns", "cities": ["St. John's"], "countries": ["Canada (Newfoundland)"]},
    "-3": {"region": "America/Sao_Paulo", "cities": ["São Paulo", "Rio de Janeiro", "Buenos Aires"], "countries": ["Brazil", "Argentina", "Uruguay"]},
    "-2": {"region": "Atlantic/South_Georgia", "cities": [], "countries": ["South Georgia"]},
    "-1": {"region": "Atlantic/Azores", "cities": ["Azores"], "countries": ["Portugal (Azores)", "Cape Verde"]},
    "0": {"region": "Europe/London", "cities": ["London", "Dublin", "Lisbon"], "countries": ["UK", "Ireland", "Portugal", "Iceland"]},
    "+1": {"region": "Europe/Paris", "cities": ["Paris", "Berlin", "Rome", "Madrid", "Amsterdam"], "countries": ["France", "Germany", "Italy", "Spain", "Netherlands", "Belgium", "Poland", "Norway", "Sweden"]},
    "+2": {"region": "Europe/Athens", "cities": ["Athens", "Helsinki", "Cairo", "Johannesburg"], "countries": ["Greece", "Finland", "Egypt", "South Africa", "Israel", "Romania", "Ukraine"]},
    "+3": {"region": "Europe/Moscow", "cities": ["Moscow", "Istanbul", "Nairobi"], "countries": ["Russia (Moscow)", "Turkey", "Kenya", "Saudi Arabia", "Iraq"]},
    "+3.5": {"region": "Asia/Tehran", "cities": ["Tehran"], "countries": ["Iran"]},
    "+4": {"region": "Asia/Dubai", "cities": ["Dubai", "Baku"], "countries": ["UAE", "Oman", "Azerbaijan", "Georgia"]},
    "+4.5": {"region": "Asia/Kabul", "cities": ["Kabul"], "countries": ["Afghanistan"]},
    "+5": {"region": "Asia/Karachi", "cities": ["Karachi", "Tashkent"], "countries": ["Pakistan", "Uzbekistan", "Kazakhstan (West)"]},
    "+5.5": {"region": "Asia/Kolkata", "cities": ["Mumbai", "Delhi", "Bangalore", "Colombo"], "countries": ["India", "Sri Lanka"]},
    "+5.75": {"region": "Asia/Kathmandu", "cities": ["Kathmandu"], "countries": ["Nepal"]},
    "+6": {"region": "Asia/Dhaka", "cities": ["Dhaka", "Almaty"], "countries": ["Bangladesh", "Kazakhstan (East)", "Kyrgyzstan"]},
    "+6.5": {"region": "Asia/Yangon", "cities": ["Yangon"], "countries": ["Myanmar"]},
    "+7": {"region": "Asia/Bangkok", "cities": ["Bangkok", "Jakarta", "Hanoi"], "countries": ["Thailand", "Indonesia (West)", "Vietnam", "Cambodia"]},
    "+8": {"region": "Asia/Shanghai", "cities": ["Beijing", "Shanghai", "Hong Kong", "Singapore", "Taipei", "Perth"], "countries": ["China", "Hong Kong", "Singapore", "Taiwan", "Malaysia", "Philippines", "Australia (West)"]},
    "+8.75": {"region": "Australia/Eucla", "cities": ["Eucla"], "countries": ["Australia (Central West)"]},
    "+9": {"region": "Asia/Tokyo", "cities": ["Tokyo", "Seoul", "Osaka"], "countries": ["Japan", "South Korea"]},
    "+9.5": {"region": "Australia/Adelaide", "cities": ["Adelaide", "Darwin"], "countries": ["Australia (Central)"]},
    "+10": {"region": "Australia/Sydney", "cities": ["Sydney", "Melbourne", "Brisbane"], "countries": ["Australia (East)", "Papua New Guinea"]},
    "+10.5": {"region": "Australia/Lord_Howe", "cities": ["Lord Howe Island"], "countries": ["Australia"]},
    "+11": {"region": "Pacific/Guadalcanal", "cities": ["Noumea"], "countries": ["Solomon Islands", "New Caledonia"]},
    "+12": {"region": "Pacific/Auckland", "cities": ["Auckland", "Wellington", "Suva"], "countries": ["New Zealand", "Fiji"]},
    "+12.75": {"region": "Pacific/Chatham", "cities": ["Chatham Islands"], "countries": ["New Zealand"]},
    "+13": {"region": "Pacific/Tongatapu", "cities": ["Nuku'alofa"], "countries": ["Tonga", "Samoa"]},
    "+14": {"region": "Pacific/Kiritimati", "cities": ["Kiritimati"], "countries": ["Kiribati"]},
}


def parse_timezone_offset(date_string):
    """
    Extract timezone offset from ISO 8601 date string.
    Returns offset in hours (e.g., -5.0, +5.5, +8.0)
    """
    try:
        # Match timezone offset pattern: +HH:MM or -HH:MM
        match = re.search(r'([+-])(\d{2}):(\d{2})$', date_string)
        if match:
            sign = 1 if match.group(1) == '+' else -1
            hours = int(match.group(2))
            minutes = int(match.group(3))
            offset = sign * (hours + minutes / 60.0)
            return offset
        return None
    except Exception:
        return None


def offset_to_key(offset):
    """Convert offset float to string key for lookup"""
    if offset is None:
        return None
    
    # Round to nearest 0.25 hour (15 minutes) for grouping
    rounded = round(offset * 4) / 4
    
    if rounded == int(rounded):
        return f"{int(rounded):+d}"
    else:
        return f"{rounded:+.2f}".rstrip('0')


def get_location_info(offset):
    """Get location information for a given timezone offset"""
    key = offset_to_key(offset)
    if key and key in TIMEZONE_TO_LOCATION:
        return TIMEZONE_TO_LOCATION[key]
    
    # Fallback for offsets not in our mapping
    return {
        "region": f"UTC{key}" if key else "Unknown",
        "cities": [],
        "countries": []
    }


def analyze_geographic_distribution(commits_data):
    """
    Analyze geographic distribution from commits data.
    Returns statistics grouped by timezone/region.
    """
    timezone_stats = defaultdict(lambda: {
        'commit_count': 0,
        'authors': set(),
        'author_commits': defaultdict(int),
        'offset': None
    })
    
    total_commits = 0
    commits_with_timezone = 0
    
    for commit in commits_data.get('commits', []):
        total_commits += 1
        date_string = commit.get('date', '')
        author_name = commit.get('author_name', 'Unknown')
        author_email = commit.get('author_email', '')
        
        offset = parse_timezone_offset(date_string)
        
        if offset is not None:
            commits_with_timezone += 1
            key = offset_to_key(offset)
            
            timezone_stats[key]['commit_count'] += 1
            timezone_stats[key]['authors'].add(author_email)
            timezone_stats[key]['author_commits'][author_email] += 1
            timezone_stats[key]['offset'] = offset
    
    # Convert to final format
    geographic_distribution = []
    
    for tz_key, stats in sorted(timezone_stats.items(), key=lambda x: float(x[0]) if x[0] else 0):
        location_info = get_location_info(stats['offset'])
        
        # Get top authors for this timezone
        top_authors = sorted(
            stats['author_commits'].items(),
            key=lambda x: x[1],
            reverse=True
        )[:5]
        
        geographic_distribution.append({
            'timezone_offset': tz_key,
            'offset_hours': stats['offset'],
            'region': location_info['region'],
            'likely_cities': location_info['cities'],
            'likely_countries': location_info['countries'],
            'commit_count': stats['commit_count'],
            'commit_percentage': round(stats['commit_count'] / commits_with_timezone * 100, 2),
            'unique_authors': len(stats['authors']),
            'top_authors': [
                {'email': email, 'commits': count}
                for email, count in top_authors
            ]
        })
    
    return {
        'repository_url': commits_data.get('repository_url', ''),
        'repository_name': commits_data.get('repository_name', ''),
        'analysis_timestamp': datetime.now().isoformat(),
        'summary': {
            'total_commits_analyzed': total_commits,
            'commits_with_timezone': commits_with_timezone,
            'commits_without_timezone': total_commits - commits_with_timezone,
            'unique_timezones': len(timezone_stats),
            'total_unique_authors': len(set(
                email for stats in timezone_stats.values() 
                for email in stats['authors']
            ))
        },
        'geographic_distribution': geographic_distribution
    }


def process_commits_file(commits_file_path, output_file_path=None):
    """
    Process a commits.json file and generate geographic distribution analysis.
    """
    print(f"Reading commits from: {commits_file_path}")
    
    try:
        with open(commits_file_path, 'r', encoding='utf-8') as f:
            commits_data = json.load(f)
    except FileNotFoundError:
        print(f"Error: File not found: {commits_file_path}")
        return False
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in file: {e}")
        return False
    
    print(f"Analyzing {commits_data.get('total_commits', 0)} commits...")
    
    # Analyze geographic distribution
    result = analyze_geographic_distribution(commits_data)
    
    # Determine output path
    if output_file_path is None:
        # Place geographic_distribution.json in the same directory as commits.json
        base_dir = os.path.dirname(commits_file_path)
        output_file_path = os.path.join(base_dir, 'geographic_distribution.json')
    
    # Save results
    with open(output_file_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"\nGeographic Distribution Analysis:")
    print(f"  Total commits: {result['summary']['total_commits_analyzed']}")
    print(f"  Commits with timezone: {result['summary']['commits_with_timezone']}")
    print(f"  Unique timezones: {result['summary']['unique_timezones']}")
    print(f"  Unique authors: {result['summary']['total_unique_authors']}")
    print(f"\nTop regions by commit count:")
    
    for i, dist in enumerate(result['geographic_distribution'][:10], 1):
        print(f"  {i}. {dist['region']} (UTC{dist['timezone_offset']}): "
              f"{dist['commit_count']} commits ({dist['commit_percentage']}%) "
              f"- {dist['unique_authors']} authors")
    
    print(f"\nResults saved to: {output_file_path}")
    return True


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("Usage: python3 analyze_geo_distribution.py <commits.json> [output.json]")
        print("\nExample:")
        print("  python3 analyze_geo_distribution.py results/my-repo/commits.json")
        print("  python3 analyze_geo_distribution.py results/my-repo/commits.json results/my-repo/geo.json")
        sys.exit(1)
    
    commits_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    success = process_commits_file(commits_file, output_file)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

