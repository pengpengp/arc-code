# Tool Use Concepts

Tool use (also called function calling) allows Claude to call external functions and tools you define, enabling it to interact with APIs, databases, filesystems, and more.

## How Tool Use Works

The tool use cycle follows a conversational pattern:

1. **You define tools** -- Each tool has a name, description, and JSON Schema for its input parameters
2. **Claude decides to use a tool** -- When appropriate, Claude returns a `tool_use` content block instead of (or alongside) text
3. **You execute the tool** -- Your code runs the tool function with the provided arguments
4. **You return results** -- Send the tool output back to Claude as a `tool_result` content block
5. **Claude continues** -- Claude uses the results to produce its final response

## Tool Definition Schema

Each tool is defined with:

```json
{
  "name": "get_weather",
  "description": "Get current weather for a location",
  "input_schema": {
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "City name or coordinates"
      },
      "unit": {
        "type": "string",
        "enum": ["celsius", "fahrenheit"],
        "description": "Temperature unit"
      }
    },
    "required": ["location"]
  }
}
```

### Tool Definition Guidelines

- **name:** Lowercase, alphanumeric, underscores allowed. Keep it short and descriptive.
- **description:** Be specific about what the tool does. Claude uses this to decide when to call it.
- **input_schema:** Standard JSON Schema. Include descriptions for each property.
- **required:** Always mark required fields to guide Claude's tool use.

## Tool Use in Messages

### Request with Tools

```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024,
  "tools": [
    {
      "name": "get_weather",
      "description": "Get current weather",
      "input_schema": {
        "type": "object",
        "properties": {
          "location": { "type": "string" }
        },
        "required": ["location"]
      }
    }
  ],
  "messages": [
    { "role": "user", "content": "What's the weather in San Francisco?" }
  ]
}
```

### Claude's Tool Use Response

```json
{
  "role": "assistant",
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01A09q90qw90lq917835lq9",
      "name": "get_weather",
      "input": { "location": "San Francisco" }
    }
  ]
}
```

### Sending Tool Results Back

```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024,
  "tools": [...],
  "messages": [
    { "role": "user", "content": "What's the weather in San Francisco?" },
    {
      "role": "assistant",
      "content": [
        {
          "type": "tool_use",
          "id": "toolu_01A09q90qw90lq917835lq9",
          "name": "get_weather",
          "input": { "location": "San Francisco" }
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "tool_result",
          "tool_use_id": "toolu_01A09q90qw90lq917835lq9",
          "content": "72°F, partly cloudy"
        }
      ]
    }
  ]
}
```

## Multi-Tool Use

Claude can call multiple tools in a single response:

```json
{
  "role": "assistant",
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01A1",
      "name": "get_temperature",
      "input": { "location": "San Francisco" }
    },
    {
      "type": "tool_use",
      "id": "toolu_01A2",
      "name": "get_humidity",
      "input": { "location": "San Francisco" }
    }
  ]
}
```

Execute all tools in parallel when possible, then send all results in a single follow-up message.

## Text + Tool Use Together

Claude can mix text and tool calls in a single response:

```json
{
  "role": "assistant",
  "content": [
    { "type": "text", "text": "Let me check the weather for you." },
    {
      "type": "tool_use",
      "id": "toolu_01A1",
      "name": "get_weather",
      "input": { "location": "San Francisco" }
    }
  ]
}
```

## `tool_choice` Parameter

Control how Claude uses tools:

- **`auto`** (default): Claude decides whether and which tool to use
- **`any`**: Claude must use at least one tool from the list
- **`tool`**: Force Claude to use a specific tool

```json
{
  "tool_choice": { "type": "tool", "name": "get_weather" }
}
```

## Best Practices

1. **Write clear descriptions** -- Both for tools and their parameters. Claude reads these to decide usage.
2. **Use required fields** -- Help Claude understand what parameters are mandatory.
3. **Keep tools focused** -- Each tool should do one thing well. Prefer many small tools over few large ones.
4. **Handle errors gracefully** -- Return error messages as tool results so Claude can recover.
5. **Use parallel tool execution** -- When Claude calls multiple tools, run them concurrently.
6. **Validate tool input** -- Check Claude's arguments before executing.
7. **Limit tool output size** -- Keep tool results concise to save tokens.
8. **Use extended thinking with tools** -- For complex reasoning, enable `thinking` to improve tool selection.

## Common Tool Use Patterns

### Database Query
```json
{
  "name": "query_database",
  "description": "Execute a read-only SQL query against the production database",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "SELECT-only SQL query" }
    },
    "required": ["query"]
  }
}
```

### Web Search
```json
{
  "name": "web_search",
  "description": "Search the web for current information",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search query" },
      "num_results": { "type": "integer", "description": "Number of results (default: 5)" }
    },
    "required": ["query"]
  }
}
```

### Code Execution
```json
{
  "name": "run_code",
  "description": "Execute Python code in a sandboxed environment",
  "input_schema": {
    "type": "object",
    "properties": {
      "code": { "type": "string", "description": "Python code to execute" },
      "language": { "type": "string", "enum": ["python", "javascript"] }
    },
    "required": ["code"]
  }
}
```

## Streaming Tool Use

When streaming, tool use blocks arrive as a sequence of delta events:

```
event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_01A1","name":"get_weather","input":{}}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"location\":\"San Francisco\"}"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}
```

Accumulate the `partial_json` deltas to reconstruct the full input object before executing the tool.
