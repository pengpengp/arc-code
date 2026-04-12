# Files API (TypeScript)

Upload files to the Anthropic API for Claude to analyze. The Files API supports text documents, code files, PDFs, and images.

## Supported File Types

| Category | Formats | Max Size |
|---|---|---|
| Text | `.txt`, `.md`, `.csv`, `.json`, `.xml` | 50 MB |
| Code | `.py`, `.js`, `.ts`, `.java`, `.go`, `.rb`, etc. | 50 MB |
| Documents | `.pdf` | 50 MB |
| Images | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` | 50 MB |

## Uploading a File

```typescript
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const anthropic = new Anthropic();

// Upload a file
const file = await anthropic.beta.files.upload({
  file: fs.createReadStream("document.pdf"),
  type: "application/pdf",
});

console.log(`File uploaded: ${file.id}`);
console.log(`File name: ${file.name}`);
console.log(`File size: ${file.size} bytes`);
```

## Using an Uploaded File in Messages

```typescript
const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "file",
            file_id: file.id,
          },
        },
        {
          type: "text",
          text: "Summarize the key findings in this document.",
        },
      ],
    },
  ],
});

console.log(message.content[0].text);
```

## Using Files with Inline Base64

Alternatively, embed file content directly in the message:

```typescript
import fs from "fs";

const pdfBuffer = fs.readFileSync("report.pdf");
const base64Data = pdfBuffer.toString("base64");

const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64Data,
          },
        },
        {
          type: "text",
          text: "What are the main points?",
        },
      ],
    },
  ],
});
```

## Analyzing Images

```typescript
const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: base64Image,
          },
        },
        {
          type: "text",
          text: "What objects are visible in this image?",
        },
      ],
    },
  ],
});
```

## Listing and Managing Files

```typescript
// List uploaded files
const files = await anthropic.beta.files.list();

for (const f of files.data) {
  console.log(`${f.id}: ${f.name} (${f.size} bytes)`);
}

// Get file details
const fileInfo = await anthropic.beta.files.retrieve("file_abc123");
console.log(fileInfo);

// Delete a file
await anthropic.beta.files.del("file_abc123");
```

## Best Practices

1. **Use file IDs for large files** -- More efficient than inline base64
2. **Delete files when done** -- Avoid storage costs and privacy risks
3. **Check file size limits** -- Stay within the 50 MB per-file limit
4. **Use appropriate media_type** -- Correct MIME type ensures proper parsing
