# cURL Examples for the Claude API

Complete examples for calling the Anthropic Claude API directly with cURL.

## Authentication

All requests require two headers:
- `x-api-key: YOUR_API_KEY` -- Your Anthropic API key
- `anthropic-version: 2023-06-01` -- API version (required)

Set your key as an environment variable:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

## Basic Text Generation

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Explain quantum computing in 3 sentences"}
    ]
  }'
```

## System Prompt

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "system": "You are a concise technical writer. Always respond in under 50 words.",
    "messages": [
      {"role": "user", "content": "What is a REST API?"}
    ]
  }'
```

## Multi-Turn Conversation

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "What is TypeScript?"},
      {"role": "assistant", "content": "TypeScript is a typed superset of JavaScript..."},
      {"role": "user", "content": "How does it compare to Python?"}
    ]
  }'
```

## Streaming Response

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -H "anthropic-beta: interleave-thinking-v1" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "stream": true,
    "messages": [
      {"role": "user", "content": "Write a haiku about programming"}
    ]
  }'
```

The response comes as Server-Sent Events (SSE):
```
event: message_start
data: {"type":"message_start","message":{"id":"msg_...","role":"assistant","content":[],"model":"claude-sonnet-4-20250514","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":15,"output_tokens":1}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Silent"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" keys"}}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":25}}

event: message_stop
data: {"type":"message_stop"}
```

## Tool Use

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "tools": [
      {
        "name": "get_weather",
        "description": "Get weather for a city",
        "input_schema": {
          "type": "object",
          "properties": {
            "city": { "type": "string" }
          },
          "required": ["city"]
        }
      }
    ],
    "messages": [
      {"role": "user", "content": "Weather in Tokyo?"}
    ]
  }'
```

## Image Input (Vision)

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "What is in this image?"
          },
          {
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": "image/png",
              "data": "iVBORw0KGgoAAAANSUhEUg..."
            }
          }
        ]
      }
    ]
  }'
```

## Extended Thinking

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -H "anthropic-beta: interleave-thinking-v1" \
  -d '{
    "model": "claude-opus-4-6-20260101",
    "max_tokens": 32000,
    "thinking": {
      "type": "enabled",
      "budget_tokens": 16000
    },
    "messages": [
      {"role": "user", "content": "Solve this complex math problem step by step..."}
    ]
  }'
```

## Temperature and Sampling

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "temperature": 0.7,
    "top_p": 0.9,
    "top_k": 40,
    "messages": [
      {"role": "user", "content": "Write a creative story"}
    ]
  }'
```

## Stop Sequences

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "stop_sequences": ["\n\n", "END"],
    "messages": [
      {"role": "user", "content": "List three items, then say END"}
    ]
  }'
```
