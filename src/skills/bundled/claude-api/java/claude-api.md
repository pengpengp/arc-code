# Java - Claude API

Call the Anthropic Claude API from Java using the official SDK.

## Installation

Add the dependency to your `build.gradle`:

```gradle
implementation 'com.anthropic:anthropic-java:latest'
```

Or for Maven:

```xml
<dependency>
    <groupId>com.anthropic</groupId>
    <artifactId>anthropic-java</artifactId>
    <version>latest</version>
</dependency>
```

## Quick Start

```java
import com.anthropic.AnthropicClient;
import com.anthropic.models.Message;
import com.anthropic.models.MessageParam;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        AnthropicClient client = AnthropicClient.builder()
            .apiKey(System.getenv("ANTHROPIC_API_KEY"))
            .build();

        Message message = client.messages().create()
            .model("claude-sonnet-4-20250514")
            .maxTokens(1024)
            .addUserMessage("Hello, Claude!")
            .execute();

        System.out.println(message.content().get(0).text().orElse(""));
    }
}
```

## Configuration

```java
AnthropicClient client = AnthropicClient.builder()
    .apiKey("sk-ant-...")
    .timeout(java.time.Duration.ofSeconds(60))
    .maxRetries(3)
    .build();
```

## Sending Messages

```java
Message message = client.messages().create()
    .model("claude-sonnet-4-20250514")
    .maxTokens(1024)
    .system("You are a helpful Java expert.")
    .messages(List.of(
        MessageParam.builder()
            .role("user")
            .content("What is a lambda expression?")
            .build(),
        MessageParam.builder()
            .role("assistant")
            .content("A lambda expression is...")
            .build(),
        MessageParam.builder()
            .role("user")
            .content("And how does it compare to anonymous classes?")
            .build()
    ))
    .execute();
```

## Streaming

```java
client.messages().createStreaming()
    .model("claude-sonnet-4-20250514")
    .maxTokens(1024)
    .addUserMessage("Write a poem about Java")
    .onText(text -> System.out.print(text))
    .execute();
```

## Tool Use

```java
Message message = client.messages().create()
    .model("claude-sonnet-4-20250514")
    .maxTokens(1024)
    .tools(List.of(
        Tool.builder()
            .name("get_weather")
            .description("Get weather for a city")
            .inputSchema(InputSchema.builder()
                .addProperty("city", JsonStringSchema.builder()
                    .description("City name")
                    .build())
                .addRequiredProperty("city")
                .build())
            .build()
    ))
    .addUserMessage("Weather in Paris?")
    .execute();
```

## Error Handling

```java
try {
    Message message = client.messages().create()
        .model("claude-sonnet-4-20250514")
        .maxTokens(1024)
        .addUserMessage("Hello")
        .execute();
} catch (AnthropicException e) {
    System.err.println("API error: " + e.getMessage());
    System.err.println("Status code: " + e.getStatusCode());
}
```
