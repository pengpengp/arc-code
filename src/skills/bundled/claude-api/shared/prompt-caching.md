# Prompt Caching

Prompt caching reduces latency and cost by caching repeated context across API requests. When you send a prompt with a cached prefix, Anthropic returns the cached computation instead of reprocessing it.

## How It Works

The API automatically caches prefixes of your messages that are repeated across requests. You don't need to manually manage cache keys -- the system detects matching prefixes.

```
Request 1: [System prompt] [Context A] [Context B] [Query 1]
                              ^--^------^ This prefix gets cached

Request 2: [System prompt] [Context A] [Context B] [Query 2]
                              ^--^------^ Cache hit! Much faster and cheaper.
```

## Pricing

- **Cache writes:** Charged at the standard input rate (one-time cost to write to cache)
- **Cache reads:** Charged at a significantly reduced rate (typically ~90% discount vs standard input)
- **Cache lifetime:** Cached prefixes expire after a set period (currently ~5 minutes of inactivity)

## Requirements

- Minimum cacheable prefix: **1,024 tokens**
- Works with the Messages API (`/v1/messages`)
- Available on all Claude models
- No special parameter needed -- caching is automatic

## Example: Reusing Context

```python
from anthropic import Anthropic

client = Anthropic()

# First request -- writes to cache
response1 = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    system="You are a helpful coding assistant. Here is the codebase context:\n" + large_context_block,
    messages=[{"role": "user", "content": "Review the authentication module"}]
)

# Second request -- cache hit on the prefix
response2 = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    system="You are a helpful coding assistant. Here is the codebase context:\n" + large_context_block,
    messages=[{"role": "user", "content": "Now review the database module"}]
)
```

The second request will show `cache_creation_input_tokens: 0` and `cache_read_input_tokens: N` in the usage metadata.

## Usage Metadata

Response includes cache usage in the `usage` object:

```json
{
  "usage": {
    "input_tokens": 150,
    "output_tokens": 320,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 2048
  }
}
```

- `cache_creation_input_tokens`: Tokens written to cache (first request)
- `cache_read_input_tokens`: Tokens read from cache (subsequent requests)

## Best Practices

1. **Put invariant content first** -- System prompts, documentation, and context that don't change should be at the start of messages.
2. **Put variable content last** -- User queries and changing data should be at the end so the prefix stays cacheable.
3. **Meet the 1,024 token minimum** -- Short prompts won't benefit from caching.
4. **Batch similar requests** -- Send cacheable requests close together in time to avoid cache expiration.
5. **Measure cache effectiveness** -- Monitor `cache_read_input_tokens` in responses.
6. **Use with tool definitions** -- Tool schemas in the system prompt are excellent cache candidates.

## When to Use Prompt Caching

| Scenario | Cache Effective? |
|---|---|
| Chat with long system prompt | Yes |
| RAG with same documents, different queries | Yes |
| Code review with same codebase | Yes |
| Completely different prompts each time | No |
| Very short prompts (< 1,024 tokens) | No |
| One-off requests | No |

## Implementation with Batches

Prompt caching also works with the [Batches API](#), where you can send thousands of requests that share a common cached prefix.
