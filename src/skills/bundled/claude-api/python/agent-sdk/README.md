# Python Agent SDK

The Claude Agent SDK for Python lets you build autonomous agent applications that can reason, plan, use tools, and take multi-step actions.

## Installation

```bash
pip install anthropic
```

The Agent SDK patterns are built on top of the core `anthropic` package using the Messages API with tool use.

## Quick Start

```python
import anthropic

client = anthropic.Anthropic()

def run_agent(prompt: str, tools: list[dict]) -> str:
    """Run an agent loop with tool use."""
    messages = [{"role": "user", "content": prompt}]

    while True:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            tools=tools,
            messages=messages,
        )

        # Check for tool use
        tool_uses = [c for c in response.content if c.type == "tool_use"]

        if not tool_uses:
            # Agent is done
            text_blocks = [c for c in response.content if c.type == "text"]
            return text_blocks[0].text if text_blocks else ""

        # Execute tools and send results back
        tool_results = []
        for tool_use in tool_uses:
            result = execute_tool(tool_use.name, tool_use.input)
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_use.id,
                "content": result,
            })

        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})


def execute_tool(name: str, input_data: dict) -> str:
    """Execute a tool and return the result."""
    match name:
        case "search_web":
            return f"Search results for '{input_data['query']}'"
        case "read_file":
            return f"Contents of {input_data['path']}"
        case "write_file":
            return f"Written to {input_data['path']}"
        case _:
            return f"Unknown tool: {name}"


# Define tools
tools = [
    {
        "name": "search_web",
        "description": "Search the web for information",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
    {
        "name": "read_file",
        "description": "Read a file from disk",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
    },
    {
        "name": "write_file",
        "description": "Write content to a file",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "content": {"type": "string"},
            },
            "required": ["path", "content"],
        },
    },
]

# Run the agent
result = run_agent("Read src/main.py and summarize it", tools)
print(result)
```

## Agent with Extended Thinking

```python
response = client.messages.create(
    model="claude-opus-4-6-20260101",
    max_tokens=32000,
    thinking={
        "type": "enabled",
        "budget_tokens": 16000,
    },
    tools=tools,
    messages=messages,
)
```

## Agent Patterns

### Research Agent

```python
def research_agent(topic: str) -> str:
    system = (
        "You are a research assistant. Use the search tool to find "
        "current information, then synthesize a comprehensive report."
    )
    return run_agent(f"{system}\n\nResearch: {topic}", tools)
```

### Coding Agent

```python
def coding_agent(task: str) -> str:
    tools = [
        {"name": "read_file", ...},
        {"name": "write_file", ...},
        {"name": "run_command", ...},
        {"name": "list_directory", ...},
    ]
    system = "You are a coding assistant. Always read a file before editing it."
    return run_agent(f"{system}\n\nTask: {task}", tools)
```

### Data Analysis Agent

```python
def data_agent(question: str) -> str:
    tools = [
        {"name": "run_python", ...},
        {"name": "read_csv", ...},
        {"name": "query_database", ...},
    ]
    system = "You are a data analyst. Use Python to analyze data."
    return run_agent(f"{system}\n\nQuestion: {question}", tools)
```

## Async Agent

```python
import asyncio
import anthropic

async def async_run_agent(prompt: str, tools: list) -> str:
    client = anthropic.AsyncAnthropic()
    messages = [{"role": "user", "content": prompt}]

    while True:
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            tools=tools,
            messages=messages,
        )

        tool_uses = [c for c in response.content if c.type == "tool_use"]
        if not tool_uses:
            text_blocks = [c for c in response.content if c.type == "text"]
            return text_blocks[0].text if text_blocks else ""

        tool_results = await asyncio.gather(*[
            async_execute_tool(tu.name, tu.input) for tu in tool_uses
        ])

        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})
```

## Best Practices

1. **Give clear tool descriptions** -- The agent's performance depends on how well tools are described
2. **Use system prompts for behavior** -- Set the agent's role, constraints, and goals
3. **Handle tool errors gracefully** -- Return error messages as tool results
4. **Set appropriate max_tokens** -- Agents may need 4096+ tokens for multi-step reasoning
5. **Use prompt caching** -- Cache system prompts and tool definitions across requests
6. **Implement guardrails** -- Validate tool inputs and outputs before executing
7. **Cap iterations** -- Always set a maximum step limit to prevent runaway costs

## Related

- [Agent Patterns](patterns.md) -- Advanced agent architectures
- [Tool Use](../claude-api/tool-use.md) -- Detailed tool use documentation
- [Streaming](../claude-api/streaming.md) -- Streaming agent responses
