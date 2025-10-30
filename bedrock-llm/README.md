# AWS Bedrock LLM Client - Standalone Module

A simple, standalone Python client for AWS Bedrock Claude Sonnet 4.5 using the `invoke_model` API.

## Supported Model

**Claude Sonnet 4.5**: `us.anthropic.claude-sonnet-4-5-20250929-v1:0`

## Quick Start

```bash
# Install dependencies
pip3 install -r requirements.txt

# Configure AWS credentials
aws configure

# Test the client
python3 bedrock_client.py
```

See [QUICKSTART.md](QUICKSTART.md) for detailed setup instructions.

## Authentication

Store your AWS credentials securely using one of these methods:

### Method 1: AWS CLI Configuration (Recommended)

```bash
aws configure
```

This stores credentials in `~/.aws/credentials`

### Method 2: Environment Variables

```bash
export AWS_ACCESS_KEY_ID="your_access_key"
export AWS_SECRET_ACCESS_KEY="your_secret_key"
export AWS_DEFAULT_REGION="us-east-1"
```

### Method 3: .env File

Copy `.env.example` to `.env` and add your credentials:

```bash
cp .env.example .env
# Edit .env with your credentials
```

### Method 4: AWS Profiles

```bash
aws configure --profile bedrock-dev
```

Then use in code:
```python
client = BedrockLLMClient(profile_name="bedrock-dev")
```

**IMPORTANT:** Never commit credentials to version control! The `.gitignore` file protects:
- `config.py`
- `.env` files
- AWS credentials
- Any files with keys/secrets

See [AUTHENTICATION.md](AUTHENTICATION.md) for complete authentication guide.

## Basic Usage

```python
from bedrock_client import BedrockLLMClient

# Initialize client
client = BedrockLLMClient(region_name="us-east-1")

# Invoke model
result = client.invoke_model(
    prompt="What are the benefits of using Git?",
    max_tokens=500,
    temperature=0.7
)

print(result['response_text'])
```

## Advanced Usage

### With System Prompt

```python
result = client.invoke_model(
    prompt="Analyze this code: def foo(x): return x*2",
    system_prompt="You are an expert code reviewer.",
    temperature=0.5,
    max_tokens=1000
)
```

### Batch Processing

```python
commits = ["feat: add auth", "fix: resolve bug", "docs: update README"]

prompt = f"Classify these commits:\n" + "\n".join(commits)

result = client.invoke_model(
    prompt=prompt,
    temperature=0.2,
    max_tokens=1500
)
```

## Configuration

Create a `config.py` from the template:

```bash
cp config.example.py config.py
# Edit config.py with your settings
```

## Examples

Run comprehensive examples:

```bash
python3 example_usage.py
```

Examples include:
1. Basic usage
2. System prompts
3. Code analysis
4. Batch commit classification
5. Temperature variations
6. Git repository insights
7. Error handling

## API Reference

### BedrockLLMClient

#### Initialize

```python
client = BedrockLLMClient(
    region_name="us-east-1",           # AWS region
    aws_access_key_id=None,             # Optional: AWS access key
    aws_secret_access_key=None,         # Optional: AWS secret key
    aws_session_token=None,             # Optional: Session token
    profile_name=None,                  # Optional: AWS profile name
    timeout=300                         # Request timeout (seconds)
)
```

#### Invoke Model

```python
result = client.invoke_model(
    prompt="Your question here",        # Required: Input prompt
    max_tokens=8000,                    # Optional: Max output tokens
    temperature=1.0,                    # Optional: 0.0-1.0 (randomness)
    top_p=0.999,                        # Optional: Nucleus sampling
    system_prompt=None                  # Optional: System instructions
)
```

**Returns:**
```python
{
    "response_text": "Generated text...",
    "model_id": "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
    "input_tokens": 25,
    "output_tokens": 150,
    "stop_reason": "end_turn",
    "raw_response": {...}  # Full API response
}
```

## Temperature Guide

- **0.0-0.3**: Deterministic, analytical (code review, classification)
- **0.4-0.7**: Balanced (general Q&A, explanations)
- **0.8-1.0**: Creative (brainstorming, creative writing)

## Error Handling

```python
from botocore.exceptions import ClientError

try:
    result = client.invoke_model(prompt="Your prompt")
except ClientError as e:
    error_code = e.response['Error']['Code']
    if error_code == 'AccessDeniedException':
        print("Check IAM permissions")
    elif error_code == 'ModelNotReadyException':
        print("Enable model in Bedrock console")
except Exception as e:
    print(f"Error: {e}")
```

## Required IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/us.anthropic.claude-sonnet-4-5-20250929-v1:0"
    }
  ]
}
```

## Troubleshooting

| Error | Solution |
|-------|----------|
| Unable to locate credentials | Run `aws configure` |
| AccessDeniedException | Check IAM permissions and enable model access |
| ModelNotReadyException | Enable Claude Sonnet 4.5 in Bedrock console |
| InvalidSignatureException | Verify credentials and check system clock |

## Cost Considerations

Claude Sonnet 4.5 pricing (varies by region):
- Input tokens: ~$3 per million tokens
- Output tokens: ~$15 per million tokens

**Tips to reduce costs:**
1. Set appropriate `max_tokens` limits
2. Use lower temperature for deterministic tasks
3. Monitor token usage via response metadata
4. Implement caching for repeated prompts

## File Structure

```
bedrock-llm/
├── bedrock_client.py       # Main client implementation
├── example_usage.py        # Comprehensive examples
├── config.example.py       # Configuration template
├── .env.example            # Environment variables template
├── requirements.txt        # Python dependencies
├── .gitignore             # Protects credentials
├── README.md              # This file
├── AUTHENTICATION.md      # Complete auth guide
└── QUICKSTART.md          # 5-minute setup guide
```

## Security Best Practices

1. Never hardcode credentials in source code
2. Use `.gitignore` to exclude credential files
3. Rotate credentials regularly
4. Use IAM roles when running on AWS
5. Enable MFA on IAM users
6. Apply least-privilege access policies
7. Monitor usage with CloudTrail

## Development

The client is designed to be:
- **Simple**: Single file, minimal dependencies
- **Standalone**: Works independently of other projects
- **Secure**: Multiple auth methods, no credential exposure
- **Well-documented**: Extensive examples and guides

## Regions with Bedrock

- `us-east-1` (N. Virginia) - Recommended
- `us-west-2` (Oregon)
- `eu-central-1` (Frankfurt)
- `ap-southeast-1` (Singapore)

Check AWS documentation for current availability.

## Support

- [QUICKSTART.md](QUICKSTART.md) - Get started in 5 minutes
- [AUTHENTICATION.md](AUTHENTICATION.md) - Complete authentication guide
- [example_usage.py](example_usage.py) - Working code examples
- AWS Bedrock Docs: https://docs.aws.amazon.com/bedrock/
- AWS CLI Config: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html

## License

This is a standalone module for your personal use. Modify as needed.
