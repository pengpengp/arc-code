# TypeScript/JavaScript - Claude API

Call the Anthropic Claude API from TypeScript and JavaScript using the official Anthropic SDK.

## Installation

```bash
npm install @anthropic-ai/sdk
# or
yarn add @anthropic-ai/sdk
# or
bun add @anthropic-ai/sdk
```

## Quick Start

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // defaults to env var
});

const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello, Claude!" }],
});

console.log(message.content[0].text);
```

## Configuration

```typescript
// Custom HTTP client options
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Optional: custom base URL for proxies
  baseURL: "https://api.anthropic.com",
  // Optional: timeout in milliseconds
  timeout: 60000,
  // Optional: max retries
  maxRetries: 2,
});
```

## Sending Messages

### Basic Message

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [
    { role: "user", content: "What are the benefits of TypeScript?" }
  ],
});
```

### With System Prompt

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  system: "You are a helpful TypeScript expert.",
  messages: [
    { role: "user", content: "Explain generics." }
  ],
});
```

### Multi-Turn Conversation

```typescript
const messages: Anthropic.MessageParam[] = [
  { role: "user", content: "What is React?" },
  { role: "assistant", content: "React is a UI library..." },
  { role: "user", content: "And Vue?" },
];

const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages,
});
```

### With Image (Vision)

```typescript
import fs from "fs";

const imageBuffer = fs.readFileSync("image.png");
const base64Image = imageBuffer.toString("base64");

const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Describe this image:" },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: base64Image,
          },
        },
      ],
    },
  ],
});
```

## Response Handling

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello" }],
});

// Access text content
const text = response.content[0].type === "text"
  ? response.content[0].text
  : "";

// Access usage metadata
console.log(`Input tokens: ${response.usage.input_tokens}`);
console.log(`Output tokens: ${response.usage.output_tokens}`);

// Access stop reason
console.log(`Stop reason: ${response.stop_reason}`);

// Access model
console.log(`Model: ${response.model}`);
```

## Error Handling

```typescript
import {
  APIError,
  RateLimitError,
  AuthenticationError,
} from "@anthropic-ai/sdk";

try {
  const response = await anthropic.messages.create({ ... });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.error("Rate limited, retrying...");
  } else if (error instanceof AuthenticationError) {
    console.error("Invalid API key");
  } else if (error instanceof APIError) {
    console.error(`API error: ${error.message}`);
  } else {
    console.error("Unknown error:", error);
  }
}
```

## Counting Tokens

```typescript
const countResponse = await anthropic.messages.countTokens({
  model: "claude-sonnet-4-20250514",
  messages: [{ role: "user", content: "Hello, Claude!" }],
  system: "You are helpful.",
});

console.log(`Token count: ${countResponse.input_tokens}`);
```

## Related Topics

- [Streaming](streaming.md) -- Receive responses token-by-token
- [Tool Use](tool-use.md) -- Function calling with Claude
- [Batches](batches.md) -- Async batch processing
- [Files API](files-api.md) -- Upload files for analysis
- [Shared: Models](../../shared/models.md) -- Model reference
- [Shared: Error Codes](../../shared/error-codes.md) -- Error handling
