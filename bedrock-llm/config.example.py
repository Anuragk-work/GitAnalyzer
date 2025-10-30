#!/usr/bin/env python3
"""
Configuration Example for AWS Bedrock Client
Copy this file to config.py and update with your settings.

NEVER commit config.py with real credentials to version control!
Add config.py to .gitignore
"""

# ==============================================================================
# AWS AUTHENTICATION - Choose ONE method below
# ==============================================================================

# METHOD 1: Use AWS CLI Configuration (RECOMMENDED)
# Run: aws configure
# This stores credentials in ~/.aws/credentials
# The client will automatically use these credentials
USE_AWS_CLI_CREDENTIALS = True

# METHOD 2: Use AWS Profile
# If you have multiple AWS profiles configured
AWS_PROFILE = None  # Set to profile name, e.g., "bedrock-dev"

# METHOD 3: Use Environment Variables
# Set these in your shell or .env file:
# export AWS_ACCESS_KEY_ID="your_access_key"
# export AWS_SECRET_ACCESS_KEY="your_secret_key"
# export AWS_SESSION_TOKEN="your_session_token"  # Optional, for temporary credentials
USE_ENVIRONMENT_VARIABLES = False

# METHOD 4: Direct Credentials (NOT RECOMMENDED - Use for testing only)
# WARNING: Never commit real credentials in this file!
AWS_ACCESS_KEY_ID = None  # "AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY = None  # "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
AWS_SESSION_TOKEN = None  # Optional, for temporary credentials

# ==============================================================================
# AWS CONFIGURATION
# ==============================================================================

# AWS Region where Bedrock is available
AWS_REGION = "us-east-1"  # Options: us-east-1, us-west-2, eu-central-1, etc.

# Request timeout in seconds
REQUEST_TIMEOUT = 300

# ==============================================================================
# MODEL CONFIGURATION
# ==============================================================================

# Default model parameters
DEFAULT_MAX_TOKENS = 8000
DEFAULT_TEMPERATURE = 0.7
DEFAULT_TOP_P = 0.999

# ==============================================================================
# LOGGING
# ==============================================================================

# Logging level: DEBUG, INFO, WARNING, ERROR
LOG_LEVEL = "INFO"

# Log to file
LOG_TO_FILE = False
LOG_FILE_PATH = "bedrock_client.log"

