# Files API (Python)

Upload files for Claude to analyze, including documents, code, PDFs, and images.

## Supported File Types

| Category | Formats | Max Size |
|---|---|---|
| Text | `.txt`, `.md`, `.csv`, `.json`, `.xml` | 50 MB |
| Code | `.py`, `.js`, `.ts`, `.java`, `.go`, `.rb` | 50 MB |
| Documents | `.pdf` | 50 MB |
| Images | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` | 50 MB |

## Uploading a File

```python
import anthropic

client = anthropic.Anthropic()

with open("document.pdf", "rb") as f:
    file = client.beta.files.upload(
        file=f,
        type="application/pdf",
    )

print(f"File ID: {file.id}")
print(f"File name: {file.name}")
print(f"Size: {file.size} bytes")
```

## Using Files in Messages

```python
message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "document",
                "source": {
                    "type": "file",
                    "file_id": file.id,
                },
            },
            {
                "type": "text",
                "text": "Summarize the key findings.",
            },
        ],
    }],
)

print(message.content[0].text)
```

## Inline Base64 (Alternative)

```python
import base64

with open("report.pdf", "rb") as f:
    data = base64.b64encode(f.read()).decode()

message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": data,
                },
            },
            {"type": "text", "text": "What are the main points?"},
        ],
    }],
)
```

## Managing Files

```python
# List files
files = client.beta.files.list()
for f in files.data:
    print(f"{f.id}: {f.name}")

# Get file info
info = client.beta.files.retrieve("file_abc123")
print(info)

# Delete file
client.beta.files.del("file_abc123")
```
