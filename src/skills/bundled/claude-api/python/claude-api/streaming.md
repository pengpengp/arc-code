# Streaming Responses (Python)

Stream Claude's responses token-by-token for low-latency, real-time UX.

## Basic Streaming

```python
import anthropic

client = anthropic.Anthropic()

with client.messages.stream(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Write a poem about coding"}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)

# Get the final message after the stream completes
message = stream.get_final_message()
print(f"\nTotal output tokens: {message.usage.output_tokens}")
```

## Streaming Events

```python
with client.messages.stream(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}],
) as stream:
    for event in stream:
        if hasattr(event, "delta") and hasattr(event.delta, "text"):
            print(event.delta.text, end="")
```

## Async Streaming

```python
import asyncio
import anthropic

async def main():
    client = anthropic.AsyncAnthropic()
    async with client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": "Hello!"}],
    ) as stream:
        async for text in stream.text_stream:
            print(text, end="", flush=True)

asyncio.run(main())
```

## Streaming with Tool Use

```python
with client.messages.stream(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=[{
        "name": "get_weather",
        "description": "Get weather for a city",
        "input_schema": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    }],
    messages=[{"role": "user", "content": "Weather in Tokyo?"}],
) as stream:
    # Accumulate tool input
    tool_input = ""
    for event in stream:
        if hasattr(event, "delta") and hasattr(event.delta, "partial_json"):
            tool_input += event.delta.partial_json

    message = stream.get_final_message()

    for content in message.content:
        if content.type == "tool_use":
            print(f"Tool: {content.name}")
            print(f"Input: {content.input}")
```

## Streaming with Extended Thinking

```python
with client.messages.stream(
    model="claude-opus-4-6-20260101",
    max_tokens=32000,
    thinking={
        "type": "enabled",
        "budget_tokens": 16000,
    },
    messages=[{"role": "user", "content": "Solve this problem..."}],
) as stream:
    for text in stream.text_stream:
        print(text, end="")
```
