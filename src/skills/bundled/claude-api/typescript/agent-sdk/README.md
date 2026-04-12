# TypeScript Agent SDK

The Claude Agent SDK for TypeScript lets you build autonomous agent applications that can reason, plan, use tools, and take multi-step actions with minimal boilerplate.

## Installation

```bash
npm install @anthropic-ai/sdk@latest
# Agent SDK is built into the main SDK
```

## Quick Start

```typescript
import { Anthropic } from "@anthropic-ai/sdk";

const client = new Anthropic();

// Simple agent that can given tools
async function runAgent(prompt: string) {
  const tools = [
    {
      name: "search_web",
      description: "Search the web for information",
      input_schema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
    {
      name: "read_file",
      description: "Read a file from disk",
      input_schema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
    {
      name: "write_file",
      description: "Write content to a file",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  ];

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt },
  ];

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      tools,
      messages,
    });

    // Check for tool use
    const toolUses = response.content.filter(
      (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
    );

    if (toolUses.length === 0) {
      // Agent is done -- return final text
      const textBlock = response.content.find(
        (c): c is Anthropic.TextBlock => c.type === "text"
      );
      return textBlock?.text ?? "";
    }

    // Execute tools and send results back
    const toolResults = toolUses.map((tu) => ({
      type: "tool_result" as const,
      tool_use_id: tu.id,
      content: await executeTool(tu.name, tu.input),
    }));

    messages.push(
      { role: "assistant", content: response.content },
      { role: "user", content: toolResults }
    );
  }
}

async function executeTool(name: string, input: any): Promise<string> {
  switch (name) {
    case "search_web":
      // Implement web search
      return `Search results for "${input.query}"`;
    case "read_file":
      // Implement file reading
      return `Contents of ${input.path}`;
    case "write_file":
      // Implement file writing
      return `Written to ${input.path}`;
    default:
      return `Unknown tool: ${name}`;
  }
}

// Run the agent
const result = await runAgent("Read the file src/index.ts and summarize it");
console.log(result);
```

## Agent with Extended Thinking

For complex reasoning tasks, enable extended thinking:

```typescript
const response = await client.messages.create({
  model: "claude-opus-4-6-20260101",
  max_tokens: 32000,
  thinking: {
    type: "enabled",
    budget_tokens: 16000,
  },
  tools,
  messages,
});
```

## Agent Patterns

### 1. Research Agent

```typescript
async function researchAgent(topic: string) {
  const system = `You are a research assistant. Use the search tool to find current information, then synthesize a comprehensive report.`;

  return runAgent(system + "\n\nResearch this topic: " + topic);
}
```

### 2. Coding Agent

```typescript
async function codingAgent(task: string) {
  const tools = [
    { name: "read_file", ... },
    { name: "write_file", ... },
    { name: "run_command", ... },
    { name: "list_directory", ... },
  ];

  const system = `You are a coding assistant. You can read files, write files, and run commands. Always read a file before editing it.`;

  return runAgent(system + "\n\nTask: " + task);
}
```

### 3. Data Analysis Agent

```typescript
async function dataAgent(question: string) {
  const tools = [
    { name: "run_python", ... },
    { name: "read_file", ... },
    { name: "query_database", ... },
  ];

  const system = `You are a data analyst. Use Python to analyze data and answer questions.`;

  return runAgent(system + "\n\nQuestion: " + question);
}
```

## Best Practices

1. **Give clear tool descriptions** -- The agent's performance depends heavily on how well tools are described
2. **Use system prompts for behavior** -- Set the agent's role, constraints, and goals in the system prompt
3. **Handle tool errors gracefully** -- Return error messages as tool results so the agent can recover
4. **Set appropriate max_tokens** -- Agents may need 4096+ tokens for multi-step reasoning
5. **Use prompt caching** -- Cache the system prompt and tool definitions across requests
6. **Implement guardrails** -- Validate tool inputs and outputs before executing

## Related

- [Agent Patterns](patterns.md) -- Advanced agent architectures
- [Tool Use](../claude-api/tool-use.md) -- Detailed tool use documentation
- [Streaming](../claude-api/streaming.md) -- Streaming agent responses
