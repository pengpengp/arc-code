# Tool Use (Python)

Implement function calling with Claude from Python.

## Defining Tools

```python
tools = [
    {
        "name": "get_weather",
        "description": "Get the current weather for a location",
        "input_schema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City name, e.g. 'San Francisco'",
                },
                "unit": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "description": "Temperature unit",
                },
            },
            "required": ["location"],
        },
    },
]
```

## Handling Tool Use Cycle

```python
import anthropic

client = anthropic.Anthropic()

def execute_tool(name: str, input_data: dict) -> str:
    """Execute a tool and return the result."""
    if name == "get_weather":
        location = input_data.get("location", "Unknown")
        return f"Weather in {location}: 72°F, sunny"
    return f"Error: Unknown tool {name}"

def chat_with_tools(messages: list) -> str:
    """Send messages and handle tool use recursively."""
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        tools=tools,
        messages=messages,
    )

    # Check for tool use
    tool_uses = [c for c in response.content if c.type == "tool_use"]

    if not tool_uses:
        # No tool use, return text
        text_blocks = [c for c in response.content if c.type == "text"]
        return text_blocks[0].text if text_blocks else ""

    # Execute tools
    tool_results = []
    for tool_use in tool_uses:
        result = execute_tool(tool_use.name, tool_use.input)
        tool_results.append({
            "type": "tool_result",
            "tool_use_id": tool_use.id,
            "content": result,
        })

    # Append assistant response and tool results
    messages.append({"role": "assistant", "content": response.content})
    messages.append({"role": "user", "content": tool_results})

    # Recurse to get final answer
    return chat_with_tools(messages)

# Usage
messages = [{"role": "user", "content": "What's the weather in London?"}]
result = chat_with_tools(messages)
print(result)
```

## Tool Choice

```python
# Force specific tool
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=tools,
    tool_choice={"type": "tool", "name": "get_weather"},
    messages=[{"role": "user", "content": "Check weather"}],
)

# Require at least one tool
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=tools,
    tool_choice={"type": "any"},
    messages=[{"role": "user", "content": "Check weather"}],
)

# Let Claude decide (default)
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=tools,
    tool_choice={"type": "auto"},
    messages=[{"role": "user", "content": "Check weather"}],
)
```

## Parallel Tool Execution

```python
import asyncio

async def execute_tool_async(name: str, input_data: dict) -> dict:
    """Execute a tool asynchronously."""
    # Simulate async operation
    result = execute_tool(name, input_data)
    return {"content": result}

async def handle_parallel_tools(tool_uses):
    """Execute multiple tools in parallel."""
    results = await asyncio.gather(*[
        execute_tool_async(tu.name, tu.input) for tu in tool_uses
    ])

    tool_results = []
    for tu, result in zip(tool_uses, results):
        tool_results.append({
            "type": "tool_result",
            "tool_use_id": tu.id,
            "content": result["content"],
        })
    return tool_results
```
