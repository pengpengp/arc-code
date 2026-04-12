# Streaming Responses (TypeScript)

Stream Claude's responses token-by-token for low-latency, real-time UX in your application.

## Basic Streaming

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const stream = await anthropic.messages.stream({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [
    { role: "user", content: "Write a short poem about coding" }
  ],
});

// Iterate over text deltas as they arrive
for await (const event of stream) {
  const text = event.delta?.text;
  if (text) {
    process.stdout.write(text);
  }
}

// Get the final complete message
const message = await stream.finalMessage();
console.log("\n--- Full message ---");
console.log(message.content[0].text);
```

## Streaming Events

The stream emits events you can listen to:

```typescript
const stream = await anthropic.messages.stream({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello!" }],
});

stream.on("text", (text) => {
  // Called with each new text delta
  console.log(text);
});

stream.on("message", (message) => {
  // Called when the full message is complete
  console.log("Done:", message);
});

stream.on("error", (error) => {
  console.error("Stream error:", error);
});
```

## Streaming with Tool Use

```typescript
const stream = await anthropic.messages.stream({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  tools: [
    {
      name: "get_weather",
      description: "Get weather for a city",
      input_schema: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
    },
  ],
  messages: [{ role: "user", content: "Weather in Paris?" }],
});

// Accumulate tool input JSON as it streams
let toolInput = "";
stream.on("content", (event) => {
  if (event.delta?.type === "input_json_delta") {
    toolInput += event.delta.partial_json;
  }
});

const message = await stream.finalMessage();

// Check if Claude wants to use a tool
for (const content of message.content) {
  if (content.type === "tool_use") {
    console.log("Tool:", content.name);
    console.log("Input:", JSON.parse(toolInput || "{}"));
  }
}
```

## Streaming with Extended Thinking

```typescript
const stream = await anthropic.messages.stream({
  model: "claude-opus-4-6-20260101",
  max_tokens: 32000,
  thinking: {
    type: "enabled",
    budget_tokens: 16000,
  },
  messages: [{ role: "user", content: "Solve this complex problem..." }],
});

stream.on("text", (text) => {
  process.stdout.write(text);
});

const message = await stream.finalMessage();

// Access thinking blocks
for (const content of message.content) {
  if (content.type === "thinking") {
    console.log("Thinking:", content.thinking);
  }
}
```

## Abort Control

```typescript
const controller = new AbortController();

const stream = await anthropic.messages.stream(
  {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Write a very long essay..." }],
  },
  { signal: controller.signal }
);

// Stop streaming after 5 seconds
setTimeout(() => controller.abort(), 5000);
```

## Full Accumulated Text Helper

```typescript
async function getStreamedText(prompt: string): Promise<string> {
  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  let fullText = "";
  for await (const event of stream) {
    if (event.delta?.type === "text_delta") {
      fullText += event.delta.text;
    }
  }
  return fullText;
}
```

## Performance Considerations

- **Time to first token:** Typically 200-500ms for Sonnet, 500-1500ms for Opus
- **Token rate:** ~50-100 tokens/second for Sonnet, ~20-50 for Opus
- **Network:** Streaming uses Server-Sent Events (SSE) over HTTP
- **Memory:** Streaming reduces memory pressure vs. waiting for full response
