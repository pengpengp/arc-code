# PHP - Claude API

Call the Anthropic Claude API from PHP.

## Installation

Using Composer:

```bash
composer require anthropic/anthropic-php
```

## Quick Start

```php
<?php

require 'vendor/autoload.php';

use Anthropic\Client;

$client = Client::factory([
    'api_key' => getenv('ANTHROPIC_API_KEY'),
]);

$response = $client->messages()->create([
    'model' => 'claude-sonnet-4-20250514',
    'max_tokens' => 1024,
    'messages' => [
        ['role' => 'user', 'content' => 'Hello, Claude!'],
    ],
]);

echo $response->content[0]->text;
```

## Configuration

```php
$client = Client::factory([
    'api_key' => 'sk-ant-...',
    'http_client_options' => [
        'timeout' => 60,
        'retries' => 3,
    ],
]);
```

## Sending Messages

```php
$response = $client->messages()->create([
    'model' => 'claude-sonnet-4-20250514',
    'max_tokens' => 1024,
    'system' => 'You are a helpful PHP expert.',
    'messages' => [
        ['role' => 'user', 'content' => 'Explain PHP 8 attributes'],
    ],
]);

echo $response->content[0]->text;
echo "\nInput tokens: " . $response->usage->inputTokens;
echo "\nOutput tokens: " . $response->usage->outputTokens;
```

## Multi-Turn Conversation

```php
$messages = [
    ['role' => 'user', 'content' => 'What is Laravel?'],
    ['role' => 'assistant', 'content' => 'Laravel is a PHP framework...'],
    ['role' => 'user', 'content' => 'How does it compare to Symfony?'],
];

$response = $client->messages()->create([
    'model' => 'claude-sonnet-4-20250514',
    'max_tokens' => 1024,
    'messages' => $messages,
]);
```

## Streaming

```php
$response = $client->messages()->createStreamed([
    'model' => 'claude-sonnet-4-20250514',
    'max_tokens' => 1024,
    'messages' => [
        ['role' => 'user', 'content' => 'Write a poem about PHP'],
    ],
]);

foreach ($response as $chunk) {
    if (isset($chunk->delta->text)) {
        echo $chunk->delta->text;
    }
}
```

## Tool Use

```php
$tools = [
    [
        'name' => 'get_weather',
        'description' => 'Get weather for a city',
        'input_schema' => [
            'type' => 'object',
            'properties' => [
                'city' => [
                    'type' => 'string',
                    'description' => 'City name',
                ],
            ],
            'required' => ['city'],
        ],
    ],
];

$response = $client->messages()->create([
    'model' => 'claude-sonnet-4-20250514',
    'max_tokens' => 1024,
    'tools' => $tools,
    'messages' => [
        ['role' => 'user', 'content' => 'Weather in Paris?'],
    ],
]);

foreach ($response->content as $content) {
    if ($content->type === 'tool_use') {
        echo "Tool: " . $content->name . "\n";
        echo "Input: " . json_encode($content->input) . "\n";
    }
}
```

## Error Handling

```php
use Anthropic\Exceptions\AnthropicException;

try {
    $response = $client->messages()->create([
        'model' => 'claude-sonnet-4-20250514',
        'max_tokens' => 1024,
        'messages' => [
            ['role' => 'user', 'content' => 'Hello'],
        ],
    ]);
} catch (AnthropicException $e) {
    echo "API error: " . $e->getMessage() . "\n";
    echo "Status: " . $e->getCode() . "\n";
}
```

## Image Input (Vision)

```php
$imageData = base64_encode(file_get_contents('image.png'));

$response = $client->messages()->create([
    'model' => 'claude-sonnet-4-20250514',
    'max_tokens' => 1024,
    'messages' => [
        [
            'role' => 'user',
            'content' => [
                ['type' => 'text', 'text' => 'Describe this image:'],
                [
                    'type' => 'image',
                    'source' => [
                        'type' => 'base64',
                        'media_type' => 'image/png',
                        'data' => $imageData,
                    ],
                ],
            ],
        ],
    ],
]);
```
