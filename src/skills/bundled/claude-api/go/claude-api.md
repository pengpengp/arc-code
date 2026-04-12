# Go - Claude API

Call the Anthropic Claude API from Go.

## Installation

```bash
go get github.com/anthropics/anthropic-sdk-go
```

## Quick Start

```go
package main

import (
    "context"
    "fmt"
    "os"

    "github.com/anthropics/anthropic-sdk-go"
    "github.com/anthropics/anthropic-sdk-go/option"
)

func main() {
    client := anthropic.NewClient(
        option.WithAPIKey(os.Getenv("ANTHROPIC_API_KEY")),
    )

    msg, err := client.Messages.New(context.TODO(), anthropic.MessageNewParams{
        Model:     anthropic.F("claude-sonnet-4-20250514"),
        MaxTokens: anthropic.F(int64(1024)),
        Messages: anthropic.F([]anthropic.MessageParam{
            anthropic.NewUserMessage(anthropic.TextParam("Hello, Claude!")),
        }),
    })
    if err != nil {
        panic(err)
    }

    fmt.Println(msg.Content[0].Text)
}
```

## Configuration

```go
client := anthropic.NewClient(
    option.WithAPIKey("sk-ant-..."),
    option.WithMaxRetries(3),
    // Custom timeout
    option.WithRequestTimeout(60 * time.Second),
)
```

## Sending Messages

```go
msg, err := client.Messages.New(context.TODO(), anthropic.MessageNewParams{
    Model:     anthropic.F("claude-sonnet-4-20250514"),
    MaxTokens: anthropic.F(int64(1024)),
    System: anthropic.F([]anthropic.TextBlockParam{
        {Text: anthropic.F("You are a helpful assistant.")},
    }),
    Messages: anthropic.F([]anthropic.MessageParam{
        anthropic.NewUserMessage(anthropic.TextParam("Explain Go concurrency")),
    }),
})
```

## Streaming

```go
stream := client.Messages.NewStreaming(context.TODO(), anthropic.MessageNewParams{
    Model:     anthropic.F("claude-sonnet-4-20250514"),
    MaxTokens: anthropic.F(int64(1024)),
    Messages: anthropic.F([]anthropic.MessageParam{
        anthropic.NewUserMessage(anthropic.TextParam("Write a poem")),
    }),
})

for stream.Next() {
    event := stream.Current()
    if delta, ok := event.Delta.(anthropic.ContentBlockDeltaEventDelta); ok {
        if textDelta, ok := delta.Delta.(anthropic.TextDelta); ok {
            fmt.Print(textDelta.Text)
        }
    }
}
```

## Tool Use

```go
tools := []anthropic.ToolParam{
    {
        Name:        anthropic.F("get_weather"),
        Description: anthropic.F("Get weather for a location"),
        InputSchema: anthropic.F(anthropic.ToolInputSchemaParam{
            Type: anthropic.F("object"),
            Properties: anthropic.F(map[string]interface{}{
                "location": map[string]interface{}{
                    "type":        "string",
                    "description": "City name",
                },
            }),
            Required: anthropic.F([]string{"location"}),
        }),
    },
}

msg, err := client.Messages.New(context.TODO(), anthropic.MessageNewParams{
    Model:     anthropic.F("claude-sonnet-4-20250514"),
    MaxTokens: anthropic.F(int64(1024)),
    Tools:     anthropic.F(tools),
    Messages: anthropic.F([]anthropic.MessageParam{
        anthropic.NewUserMessage(anthropic.TextParam("Weather in Berlin?")),
    }),
})
```

## Error Handling

```go
msg, err := client.Messages.New(context.TODO(), params)
if err != nil {
    var apiErr *anthropic.Error
    if errors.As(err, &apiErr) {
        fmt.Printf("API error: %s (type: %s)\n", apiErr.Message, apiErr.Type)
    }
}
```
