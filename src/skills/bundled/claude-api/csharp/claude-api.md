# C# - Claude API

Call the Anthropic Claude API from C# / .NET.

## Installation

```bash
dotnet add package Anthropic.SDK
```

## Quick Start

```csharp
using Anthropic.SDK;

var client = new AnthropicClient(Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY"));

var parameters = new MessageParameters
{
    Model = Models.ClaudeSonnet4,
    MaxTokens = 1024,
    Messages = new List<Message>
    {
        new Message(RoleType.User, "Hello, Claude!")
    }
};

var response = await client.Messages.GetClaudeMessageAsync(parameters);
Console.WriteLine(response.Message.ToString());
```

## Configuration

```csharp
var client = new AnthropicClient(
    apiKey: "sk-ant-...",
    timeoutSeconds: 60
);
```

## Sending Messages

```csharp
var parameters = new MessageParameters
{
    Model = Models.ClaudeSonnet4,
    MaxTokens = 1024,
    System = new List<TextContent>
    {
        new TextContent("You are a helpful C# expert.")
    },
    Messages = new List<Message>
    {
        new Message(RoleType.User, "Explain async/await in C#"),
    }
};

var response = await client.Messages.GetClaudeMessageAsync(parameters);
```

## Multi-Turn Conversation

```csharp
var messages = new List<Message>
{
    new Message(RoleType.User, "What is Entity Framework?"),
    new Message(RoleType.Assistant, "Entity Framework is an ORM..."),
    new Message(RoleType.User, "How does it compare to Dapper?"),
};

var parameters = new MessageParameters
{
    Model = Models.ClaudeSonnet4,
    MaxTokens = 1024,
    Messages = messages
};
```

## Streaming

```csharp
var parameters = new MessageParameters
{
    Model = Models.ClaudeSonnet4,
    MaxTokens = 1024,
    Messages = new List<Message>
    {
        new Message(RoleType.User, "Write a poem about C#")
    },
    Stream = true
};

await foreach (var chunk in client.Messages.StreamClaudeMessageAsync(parameters))
{
    if (chunk.Delta?.Text != null)
    {
        Console.Write(chunk.Delta.Text);
    }
}
```

## Tool Use

```csharp
var parameters = new MessageParameters
{
    Model = Models.ClaudeSonnet4,
    MaxTokens = 1024,
    Messages = new List<Message>
    {
        new Message(RoleType.User, "What's the weather in Seattle?")
    },
    Tools = new List<Tool>
    {
        new Tool
        {
            Name = "get_weather",
            Description = "Get current weather for a city",
            InputSchema = new InputSchema
            {
                Type = "object",
                Properties = new Dictionary<string, SchemaProperty>
                {
                    ["city"] = new SchemaProperty { Type = "string", Description = "City name" }
                },
                Required = new List<string> { "city" }
            }
        }
    }
};

var response = await client.Messages.GetClaudeMessageAsync(parameters);

foreach (var content in response.Message.Content)
{
    if (content is ToolUseContent toolUse)
    {
        Console.WriteLine($"Tool: {toolUse.Name}");
        Console.WriteLine($"Input: {toolUse.Input}");
    }
}
```

## Error Handling

```csharp
try
{
    var response = await client.Messages.GetClaudeMessageAsync(parameters);
}
catch (AnthropicException ex)
{
    Console.WriteLine($"API error: {ex.Message}");
    Console.WriteLine($"Status: {ex.StatusCode}");
}
```
