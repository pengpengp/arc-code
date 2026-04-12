# Tool Use (TypeScript)

Implement function calling with Claude from TypeScript.

## Defining Tools

```typescript
import Anthropic from "@anthropic-ai/sdk";

const tools: Anthropic.Tool[] = [
  {
    name: "get_weather",
    description: "Get the current weather for a location",
    input_schema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City name, e.g. 'San Francisco'",
        },
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          description: "Temperature unit",
        },
      },
      required: ["location"],
    },
  },
  {
    name: "send_email",
    description: "Send an email to a recipient",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email" },
        subject: { type: "string", description: "Email subject" },
        body: { type: "string", description: "Email body" },
      },
      required: ["to", "subject", "body"],
    },
  },
];
```

## Handling Tool Use Cycle

```typescript
async function chatWithTools(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    tools,
    messages,
  });

  // Check if Claude wants to use tools
  const toolUseBlocks = response.content.filter(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
  );

  if (toolUseBlocks.length === 0) {
    // No tool use -- return text response
    const textBlock = response.content.find(
      (c): c is Anthropic.TextBlock => c.type === "text",
    );
    return textBlock?.text ?? "";
  }

  // Execute tools
  const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map(
    (toolUse) => {
      const result = executeTool(toolUse.name, toolUse.input);
      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result,
      };
    },
  );

  // Send results back and recurse
  messages.push(
    { role: "assistant", content: response.content },
    { role: "user", content: toolResults },
  );

  return chatWithTools(client, messages);
}

function executeTool(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "get_weather":
      return `Weather in ${input.location}: 72°F, sunny`;
    case "send_email":
      return `Email sent to ${input.to}`;
    default:
      return `Error: Unknown tool ${name}`;
  }
}
```

## Tool Choice

```typescript
// Force a specific tool
const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  tools,
  tool_choice: { type: "tool", name: "get_weather" },
  messages: [{ role: "user", content: "Check weather" }],
});

// Require at least one tool
const response2 = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  tools,
  tool_choice: { type: "any" },
  messages: [{ role: "user", content: "Check weather" }],
});

// Let Claude decide (default)
const response3 = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  tools,
  tool_choice: { type: "auto" },
  messages: [{ role: "user", content: "Check weather" }],
});
```

## Error Handling in Tool Results

```typescript
function executeToolWithError(name: string, input: Record<string, unknown>): {
  content: string;
  isError?: boolean;
} {
  try {
    switch (name) {
      case "get_weather":
        return { content: `Weather in ${input.location}: 72°F` };
      default:
        return {
          content: `Unknown tool: ${name}`,
          isError: true,
        };
    }
  } catch (err) {
    return {
      content: `Error executing ${name}: ${(err as Error).message}`,
      isError: true,
    };
  }
}
```

## Parallel Tool Execution

When Claude requests multiple tools in one response, execute them in parallel:

```typescript
const toolUseBlocks = response.content.filter(
  (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
);

const results = await Promise.all(
  toolUseBlocks.map(async (toolUse) => {
    const result = await executeToolAsync(toolUse.name, toolUse.input);
    return {
      type: "tool_result" as const,
      tool_use_id: toolUse.id,
      content: result,
    };
  }),
);
```
