#!/usr/bin/env python3
"""
Example usage of the Bedrock LLM Client.
Demonstrates various use cases and configurations.
"""

from bedrock_client import BedrockLLMClient
import json


def example_1_basic_usage():
    """Example 1: Basic usage with default settings."""
    print("\n" + "=" * 70)
    print("EXAMPLE 1: Basic Usage")
    print("=" * 70)
    
    # Initialize client (uses default AWS credentials)
    client = BedrockLLMClient(region_name="us-east-1")
    
    # Simple prompt
    result = client.invoke_model(
        prompt="What are the benefits of using Git for version control?"
    )
    
    print(f"\nResponse:\n{result['response_text']}")
    print(f"\nTokens used: {result['input_tokens']} in, {result['output_tokens']} out")


def example_2_with_system_prompt():
    """Example 2: Using system prompt for specialized behavior."""
    print("\n" + "=" * 70)
    print("EXAMPLE 2: With System Prompt")
    print("=" * 70)
    
    client = BedrockLLMClient(region_name="us-east-1")
    
    # Use system prompt to set context
    result = client.invoke_model(
        prompt="Analyze this commit message: 'fix: resolved bug in authentication'",
        system_prompt="You are a Git commit analyzer. Classify commits and provide insights.",
        temperature=0.5,  # Lower temperature for more consistent analysis
        max_tokens=500
    )
    
    print(f"\nResponse:\n{result['response_text']}")


def example_3_analyze_code():
    """Example 3: Code analysis with different temperature."""
    print("\n" + "=" * 70)
    print("EXAMPLE 3: Code Analysis")
    print("=" * 70)
    
    client = BedrockLLMClient(region_name="us-east-1")
    
    code_snippet = """
def calculate_complexity(data):
    result = []
    for item in data:
        if item > 0:
            for i in range(item):
                result.append(i * 2)
    return result
"""
    
    prompt = f"""Analyze this Python function for:
1. Time complexity
2. Space complexity
3. Potential improvements

Code:
{code_snippet}
"""
    
    result = client.invoke_model(
        prompt=prompt,
        temperature=0.3,  # Low temperature for analytical tasks
        max_tokens=1000
    )
    
    print(f"\nAnalysis:\n{result['response_text']}")


def example_4_batch_analysis():
    """Example 4: Analyze multiple items in batch."""
    print("\n" + "=" * 70)
    print("EXAMPLE 4: Batch Commit Analysis")
    print("=" * 70)
    
    client = BedrockLLMClient(region_name="us-east-1")
    
    commits = [
        "feat: add user authentication module",
        "fix: resolve null pointer exception in payment",
        "docs: update API documentation",
        "refactor: simplify database queries",
        "chore: update dependencies"
    ]
    
    prompt = f"""Classify these commit messages by type (feature, bugfix, docs, refactor, chore, etc.) and provide a brief analysis:

Commits:
{chr(10).join(f'{i+1}. {commit}' for i, commit in enumerate(commits))}

Provide output in JSON format with: type, category, description for each."""
    
    result = client.invoke_model(
        prompt=prompt,
        temperature=0.2,  # Very low for structured output
        max_tokens=1500
    )
    
    print(f"\nClassification:\n{result['response_text']}")


def example_5_different_temperatures():
    """Example 5: Different temperature settings."""
    print("\n" + "=" * 70)
    print("EXAMPLE 5: Different Temperature Settings")
    print("=" * 70)
    
    client = BedrockLLMClient(region_name="us-east-1")
    
    prompt = "Summarize the key principles of clean code in 3 bullet points."
    
    # Test with different temperatures
    temperatures = [0.3, 0.7, 1.0]
    
    for temp in temperatures:
        print(f"\n--- Temperature: {temp} ---")
        try:
            result = client.invoke_model(
                prompt=prompt,
                max_tokens=300,
                temperature=temp
            )
            print(f"\n{result['response_text']}")
            print(f"\nTokens: {result['input_tokens']} in, {result['output_tokens']} out")
        except Exception as e:
            print(f"Error with temperature {temp}: {e}")


def example_6_with_aws_profile():
    """Example 6: Using specific AWS profile."""
    print("\n" + "=" * 70)
    print("EXAMPLE 6: Using AWS Profile")
    print("=" * 70)
    
    # Initialize with specific AWS profile
    # This is useful when you have multiple AWS accounts/profiles
    try:
        client = BedrockLLMClient(
            region_name="us-east-1",
            profile_name="default"  # Change to your profile name
        )
        
        result = client.invoke_model(
            prompt="What is continuous integration?",
            max_tokens=200
        )
        
        print(f"\nResponse:\n{result['response_text']}")
        
    except Exception as e:
        print(f"Note: This example requires AWS profile configuration: {e}")


def example_7_git_commit_insights():
    """Example 7: Real-world use case - Git commit insights."""
    print("\n" + "=" * 70)
    print("EXAMPLE 7: Git Commit Insights Generation")
    print("=" * 70)
    
    client = BedrockLLMClient(region_name="us-east-1")
    
    # Simulate commit data from git analysis
    commit_data = {
        "total_commits": 1547,
        "top_contributors": [
            {"name": "John Doe", "commits": 623},
            {"name": "Jane Smith", "commits": 412},
            {"name": "Bob Wilson", "commits": 287}
        ],
        "commit_patterns": {
            "features": 456,
            "bugfixes": 389,
            "refactoring": 234,
            "documentation": 167,
            "other": 301
        },
        "most_active_files": [
            {"file": "src/api/users.py", "changes": 89},
            {"file": "src/models/database.py", "changes": 67},
            {"file": "tests/test_auth.py", "changes": 54}
        ]
    }
    
    prompt = f"""Analyze this Git repository data and provide insights:

Repository Statistics:
{json.dumps(commit_data, indent=2)}

Please provide:
1. Overall project health assessment
2. Team collaboration patterns
3. Areas of high activity/risk
4. Recommendations for improvement

Be specific and actionable."""
    
    result = client.invoke_model(
        prompt=prompt,
        system_prompt="You are an expert software engineering consultant analyzing Git repositories.",
        temperature=0.6,
        max_tokens=2000
    )
    
    print(f"\nInsights:\n{result['response_text']}")
    print(f"\nAnalysis used {result['input_tokens']} input tokens and generated {result['output_tokens']} output tokens")


def example_8_error_handling():
    """Example 8: Proper error handling."""
    print("\n" + "=" * 70)
    print("EXAMPLE 8: Error Handling")
    print("=" * 70)
    
    try:
        client = BedrockLLMClient(region_name="us-east-1")
        
        # Try with invalid max_tokens
        result = client.invoke_model(
            prompt="Test prompt",
            max_tokens=-100  # Invalid value
        )
        
    except ValueError as e:
        print(f"Caught expected error: {e}")
    
    except Exception as e:
        print(f"Unexpected error: {e}")


def main():
    """Run all examples."""
    print("\nBedrock LLM Client - Usage Examples")
    print("=" * 70)
    
    examples = [
        ("Basic Usage", example_1_basic_usage),
        ("System Prompt", example_2_with_system_prompt),
        ("Code Analysis", example_3_analyze_code),
        ("Batch Analysis", example_4_batch_analysis),
        ("Temperature Settings", example_5_different_temperatures),
        ("AWS Profile", example_6_with_aws_profile),
        ("Git Insights", example_7_git_commit_insights),
        ("Error Handling", example_8_error_handling)
    ]
    
    print("\nAvailable examples:")
    for i, (name, _) in enumerate(examples, 1):
        print(f"  {i}. {name}")
    
    print("\nRunning all examples...")
    print("(Note: Some examples may fail if AWS credentials are not configured)")
    
    for name, example_func in examples:
        try:
            example_func()
        except Exception as e:
            print(f"\nWarning: Example '{name}' failed: {e}")
            print("This might be due to missing AWS credentials or Bedrock access.")
    
    print("\n" + "=" * 70)
    print("Examples completed!")
    print("=" * 70)


if __name__ == "__main__":
    main()

