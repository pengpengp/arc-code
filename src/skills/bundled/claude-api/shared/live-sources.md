# Live Sources

Live sources (also called grounding) allow Claude to incorporate real-time information from external sources into its responses, such as web search results or uploaded file contents.

## Overview

By default, Claude's knowledge is limited to its training data. Live sources extend this by providing:

- **Web search** -- Current information from the internet
- **File sources** -- Content from uploaded files that Claude can analyze
- **Custom sources** -- Your own data sources via tool use

## Web Search Grounding

When web search is enabled, Claude can retrieve current information from the web to answer questions about recent events, current data, or real-time facts.

### Enabling Web Search

Web search is available as a source type in the Messages API:

```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024,
  "messages": [
    { "role": "user", "content": "What are the latest AI news this week?" }
  ],
  "tools": [
    {
      "type": "web_search"
    }
  ]
}
```

### How Web Search Works

1. Claude identifies that the query requires current information
2. The API performs a web search using the query
3. Search results are injected into the context
4. Claude generates a response grounded in the search results
5. Responses include citations to the source URLs

### Response with Citations

When Claude uses live sources, the response includes source references:

```json
{
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "According to recent reports, ..."
    }
  ],
  "citations": [
    {
      "type": "url_citation",
      "url": "https://example.com/article",
      "title": "Article Title"
    }
  ]
}
```

## File Sources

Upload files via the [Files API](files-api.md) and reference them in messages:

```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024,
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "document",
          "source": {
            "type": "file",
            "file_id": "file_abc123"
          }
        },
        {
          "type": "text",
          "text": "Summarize this document."
        }
      ]
    }
  ]
}
```

## Best Practices

1. **Use web search for time-sensitive queries** -- Current events, stock prices, sports scores
2. **Use file sources for document analysis** -- PDFs, text files, code files
3. **Combine with tool use** -- Use custom tools to access your own databases
4. **Verify citations** -- Check source URLs for accuracy
5. **Consider latency** -- Web search adds latency to the response
6. **Handle search failures** -- Web search may not always find relevant results

## Supported Content Types for Files

| Type | Formats |
|---|---|
| Text | `.txt`, `.md`, `.csv`, `.json`, `.xml` |
| Code | `.py`, `.js`, `.ts`, `.java`, `.go`, `.rb`, etc. |
| Documents | `.pdf` |
| Images | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` |

## Limitations

- Web search availability depends on the model and API version
- File size limits apply (see [Files API](files-api.md))
- Search results may not cover very recent events (crawl delay)
- Not all models support all source types
