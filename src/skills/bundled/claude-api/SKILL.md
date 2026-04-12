# Claude API Skill

Build applications that integrate with the Anthropic Claude API and Claude Agent SDK.

## When to use this skill

- Building applications that call the Claude Messages API
- Implementing tool use / function calling with Claude
- Streaming responses from Claude
- Building autonomous agents with the Claude Agent SDK
- Working with batches, files, or prompt caching
- Migrating from other LLM APIs to Claude

## Documentation structure

This skill is organized by language and topic:

### Shared references
- [Models](shared/models.md) -- Current Claude model lineup with context windows and pricing
- [Error codes](shared/error-codes.md) -- Common API error responses and how to handle them
- [Tool use concepts](shared/tool-use-concepts.md) -- Function calling patterns and best practices
- [Prompt caching](shared/prompt-caching.md) -- Caching for reduced latency and cost
- [Live sources](shared/live-sources.md) -- Grounding with live web and file sources

### Language-specific API docs
- [TypeScript/JavaScript](typescript/claude-api/README.md)
- [Python](python/claude-api/README.md)
- [cURL](curl/examples.md)
- [Go](go/claude-api.md)
- [Java](java/claude-api.md)
- [C#](csharp/claude-api.md)
- [Ruby](ruby/claude-api.md)
- [PHP](php/claude-api.md)

### Agent SDK (for building autonomous agents)
- [TypeScript Agent SDK](typescript/agent-sdk/README.md)
- [Python Agent SDK](python/agent-sdk/README.md)

### Advanced topics
- [Streaming](typescript/claude-api/streaming.md) | [Python](python/claude-api/streaming.md)
- [Tool use implementation](typescript/claude-api/tool-use.md) | [Python](python/claude-api/tool-use.md)
- [Batches](typescript/claude-api/batches.md) | [Python](python/claude-api/batches.md)
- [Files API](typescript/claude-api/files-api.md) | [Python](python/claude-api/files-api.md)

## Quick start

The Claude API endpoint is `https://api.anthropic.com/v1/messages`. Authentication is via the `x-api-key` header.

### Minimal cURL example
```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello, Claude!"}]
  }'
```

### Key concepts
1. **Messages API** -- The primary API for sending prompts and receiving responses
2. **Tool use** -- Claude can call functions/tools you define, enabling code execution, API calls, etc.
3. **Streaming** -- Receive responses token-by-token for low-latency UX
4. **Prompt caching** -- Cache repeated context to reduce cost and latency
5. **Batches** -- Submit large volumes of prompts for async processing
6. **Files API** -- Upload files for Claude to analyze

## Important notes
- Always use the latest API version header (currently `2023-06-01`)
- Store API keys securely; never commit them to version control
- Use `ANTHROPIC_API_KEY` environment variable for authentication
- Model IDs follow the pattern `claude-{family}-{version}-{date}`
- All requests require `max_tokens` to be set
