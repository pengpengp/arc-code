# Python - Claude API

Call the Anthropic Claude API from Python using the official Anthropic SDK.

## Installation

```bash
pip install anthropic
```

## Quick Start

```python
import anthropic

client = anthropic.Anthropic()  # Uses ANTHROPIC_API_KEY env var

message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello, Claude!"}]
)

print(message.content[0].text)
```

## Configuration

```python
import anthropic

client = anthropic.Anthropic(
    api_key="sk-ant-...",           # Or use ANTHROPIC_API_KEY env var
    timeout=60.0,                    # Request timeout in seconds
    max_retries=2,                   # Auto-retries on transient errors
)

# Async client
async_client = anthropic.AsyncAnthropic()
```

## Sending Messages

### Basic Message

```python
message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "What is Python?"}]
)
```

### With System Prompt

```python
message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    system="You are a helpful Python tutor.",
    messages=[{"role": "user", "content": "Explain list comprehensions"}]
)
```

### Multi-Turn Conversation

```python
messages = [
    {"role": "user", "content": "What is Flask?"},
    {"role": "assistant", "content": "Flask is a micro web framework..."},
    {"role": "user", "content": "How does it compare to FastAPI?"},
]

message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=messages
)
```

### With Image (Vision)

```python
import base64

with open("image.png", "rb") as f:
    image_data = base64.b64encode(f.read()).decode()

message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "Describe this image:"},
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": image_data,
                },
            },
        ],
    }]
)
```

## Response Handling

```python
message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}]
)

# Text content
text = message.content[0].text

# Usage stats
print(f"Input tokens: {message.usage.input_tokens}")
print(f"Output tokens: {message.usage.output_tokens}")
print(f"Cache reads: {message.usage.cache_read_input_tokens}")
print(f"Stop reason: {message.stop_reason}")
```

## Async Usage

```python
import asyncio
import anthropic

async def main():
    client = anthropic.AsyncAnthropic()
    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": "Hello async!"}]
    )
    print(message.content[0].text)

asyncio.run(main())
```

## Error Handling

```python
import anthropic

try:
    message = client.messages.create(...)
except anthropic.AuthenticationError:
    print("Invalid API key")
except anthropic.RateLimitError:
    print("Rate limited")
except anthropic.BadRequestError as e:
    print(f"Bad request: {e}")
except anthropic.APIStatusError as e:
    print(f"API error: {e.status_code} - {e.message}")
```

## Related Topics

- [Streaming](streaming.md) -- Real-time token streaming
- [Tool Use](tool-use.md) -- Function calling
- [Batches](batches.md) -- Async batch processing
- [Files API](files-api.md) -- File uploads
- [Shared: Models](../../shared/models.md) -- Model reference
- [Shared: Error Codes](../../shared/error-codes.md) -- Error handling
