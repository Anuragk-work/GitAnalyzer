#!/usr/bin/env python3
"""
AWS Bedrock LLM Client - Standalone Module
Provides easy-to-use interface for invoking AWS Bedrock models.

Supports multiple Bedrock model families:
- Claude (Anthropic)
- Titan (Amazon)
- Llama (Meta)
- Mistral AI
- Cohere
"""

import json
import logging
from typing import Dict, Any, Optional, List
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("bedrock-client")


class BedrockLLMClient:
    """
    AWS Bedrock LLM Client for Claude Sonnet 4.5.
    
    Supported Model:
    - Claude Sonnet 4.5: us.anthropic.claude-sonnet-4-5-20250929-v1:0
    """
    
    # Model ID
    MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
    DEFAULT_MAX_TOKENS = 8000
    
    def __init__(
        self, 
        region_name: str = "us-east-1",
        aws_access_key_id: Optional[str] = None,
        aws_secret_access_key: Optional[str] = None,
        aws_session_token: Optional[str] = None,
        profile_name: Optional[str] = None,
        timeout: int = 300
    ):
        """
        Initialize Bedrock client.
        
        Args:
            region_name: AWS region (default: us-east-1)
            aws_access_key_id: AWS access key (optional, uses default credentials if not provided)
            aws_secret_access_key: AWS secret key (optional)
            aws_session_token: AWS session token (optional, for temporary credentials)
            profile_name: AWS profile name (optional, uses default profile if not provided)
            timeout: Request timeout in seconds (default: 300)
        """
        self.region_name = region_name
        
        # Configure boto3 client settings
        config = Config(
            region_name=region_name,
            read_timeout=timeout,
            connect_timeout=10,
            retries={'max_attempts': 3, 'mode': 'adaptive'}
        )
        
        # Build session kwargs
        session_kwargs = {}
        if profile_name:
            session_kwargs['profile_name'] = profile_name
        if aws_access_key_id:
            session_kwargs['aws_access_key_id'] = aws_access_key_id
        if aws_secret_access_key:
            session_kwargs['aws_secret_access_key'] = aws_secret_access_key
        if aws_session_token:
            session_kwargs['aws_session_token'] = aws_session_token
        
        # Create session and client
        try:
            if session_kwargs:
                session = boto3.Session(**session_kwargs)
                self.client = session.client('bedrock-runtime', config=config)
            else:
                self.client = boto3.client('bedrock-runtime', config=config)
            
            logger.info(f"Bedrock client initialized successfully (region: {region_name})")
        except Exception as e:
            logger.error(f"Failed to initialize Bedrock client: {e}")
            raise
    
    def invoke_model(
        self,
        prompt: str,
        max_tokens: Optional[int] = None,
        temperature: float = 1.0,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Invoke Claude Sonnet 4.5 with the given prompt.
        
        Args:
            prompt: The input prompt/question for the model
            max_tokens: Maximum tokens to generate (default: 8000)
            temperature: Controls randomness (0.0-1.0, higher = more random)
            system_prompt: System prompt to guide model behavior
            **kwargs: Additional model-specific parameters
            
        Returns:
            Dictionary with response data including:
            - response_text: The generated text
            - model_id: Full model ID used
            - input_tokens: Number of input tokens
            - output_tokens: Number of output tokens
            - stop_reason: Why the model stopped generating
            - raw_response: Full raw response from Bedrock
        """
        try:
            # Use default max_tokens if not specified
            if max_tokens is None:
                max_tokens = self.DEFAULT_MAX_TOKENS
            
            logger.info(f"Invoking model: {self.MODEL_ID}")
            logger.debug(f"   Temperature: {temperature}, Max Tokens: {max_tokens}")
            
            # Build request for Claude
            request_body = self._build_anthropic_request(
                prompt, max_tokens, temperature, system_prompt, **kwargs
            )
            
            # Invoke model
            response = self.client.invoke_model(
                modelId=self.MODEL_ID,
                contentType="application/json",
                accept="application/json",
                body=json.dumps(request_body)
            )
            
            # Parse response
            response_body = json.loads(response['body'].read())
            
            # Extract text and metadata
            result = self._parse_response(response_body)
            
            logger.info(f"Model invocation successful")
            logger.info(f"   Input tokens: {result.get('input_tokens', 'N/A')}")
            logger.info(f"   Output tokens: {result.get('output_tokens', 'N/A')}")
            
            return result
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            logger.error(f"AWS Bedrock error ({error_code}): {error_message}")
            raise
        except Exception as e:
            logger.error(f"Model invocation failed: {e}")
            raise
    
    def _build_anthropic_request(
        self,
        prompt: str,
        max_tokens: int,
        temperature: float,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Build request body for Anthropic Claude models."""
        request = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": temperature
        }
        
        if system_prompt:
            request["system"] = system_prompt
        
        # Add any additional kwargs
        request.update(kwargs)
        
        return request
    
    def _parse_response(self, response_body: Dict[str, Any]) -> Dict[str, Any]:
        """Parse Claude response."""
        content = response_body.get("content", [])
        text = content[0].get("text", "") if content else ""
        
        return {
            "response_text": text,
            "model_id": self.MODEL_ID,
            "input_tokens": response_body.get("usage", {}).get("input_tokens", 0),
            "output_tokens": response_body.get("usage", {}).get("output_tokens", 0),
            "stop_reason": response_body.get("stop_reason", "unknown"),
            "raw_response": response_body
        }
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the model.
        
        Returns:
            Dictionary with model configuration
        """
        return {
            "model_id": self.MODEL_ID,
            "default_max_tokens": self.DEFAULT_MAX_TOKENS,
            "provider": "anthropic"
        }


def main():
    """Example usage of BedrockLLMClient."""
    import sys
    
    # Initialize client
    print("Initializing Bedrock client...")
    client = BedrockLLMClient(region_name="us-east-1")
    
    # Show model info
    print("\nModel Information:")
    print("=" * 70)
    model_info = client.get_model_info()
    print(f"  Model ID: {model_info['model_id']}")
    print(f"  Provider: {model_info['provider']}")
    print(f"  Default Max Tokens: {model_info['default_max_tokens']}")
    print()
    
    # Test prompt
    test_prompt = "Explain what AWS Bedrock is in one sentence."
    
    try:
        print(f"\nTesting model invocation...")
        print(f"Prompt: {test_prompt}")
        print("=" * 70)
        
        # Invoke model
        result = client.invoke_model(
            prompt=test_prompt,
            max_tokens=200,
            temperature=0.7
        )
        
        print(f"\nResponse:")
        print(f"{result['response_text']}")
        print()
        print(f"Stats:")
        print(f"  Input tokens: {result['input_tokens']}")
        print(f"  Output tokens: {result['output_tokens']}")
        print(f"  Stop reason: {result['stop_reason']}")
        
    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

