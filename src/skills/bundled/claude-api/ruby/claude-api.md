# Ruby - Claude API

Call the Anthropic Claude API from Ruby.

## Installation

```bash
gem install anthropic-ruby
```

Or add to your Gemfile:

```ruby
gem "anthropic-ruby"
```

## Quick Start

```ruby
require "anthropic-ruby"

client = Anthropic::Client.new(
  access_token: ENV["ANTHROPIC_API_KEY"]
)

response = client.messages(
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [
    { role: "user", content: "Hello, Claude!" }
  ]
)

puts response["content"][0]["text"]
```

## Configuration

```ruby
client = Anthropic::Client.new(
  access_token: "sk-ant-...",
  anthropic_version: "2023-06-01"
)
```

## Sending Messages

```ruby
response = client.messages(
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  system: "You are a helpful Ruby expert.",
  messages: [
    { role: "user", content: "Explain Ruby metaprogramming" }
  ]
)
```

## Multi-Turn Conversation

```ruby
messages = [
  { role: "user", content: "What is Rails?" },
  { role: "assistant", content: "Rails is a web framework..." },
  { role: "user", content: "What about Sinatra?" }
]

response = client.messages(
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: messages
)
```

## Streaming

```ruby
response = client.messages(
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [
    { role: "user", content: "Write a poem about Ruby" }
  ],
  stream: true
) do |chunk, _bytes|
  delta = chunk.dig("delta", "text")
  print delta if delta
end
```

## Tool Use

```ruby
tools = [
  {
    name: "get_weather",
    description: "Get weather for a city",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" }
      },
      required: ["city"]
    }
  }
]

response = client.messages(
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  tools: tools,
  messages: [
    { role: "user", content: "Weather in Tokyo?" }
  ]
)

# Check for tool use
response["content"].each do |content|
  if content["type"] == "tool_use"
    puts "Tool: #{content['name']}"
    puts "Input: #{content['input']}"
  end
end
```

## Error Handling

```ruby
begin
  response = client.messages(
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Hello" }]
  )
rescue Anthropic::Error => e
  puts "API error: #{e.message}"
rescue => e
  puts "Unexpected error: #{e.message}"
end
```

## Image Input (Vision)

```ruby
require "base64"

image_data = Base64.encode64(File.read("image.png"))

response = client.messages(
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
            data: image_data
          }
        }
      ]
    }
  ]
)
```
