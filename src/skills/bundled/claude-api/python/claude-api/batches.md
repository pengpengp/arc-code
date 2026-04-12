# Batches API (Python)

Submit large volumes of message requests for asynchronous batch processing.

## When to Use Batches

- Bulk document classification
- Large-scale translation
- Offline data enrichment
- Processing thousands of prompts where real-time response is not needed

## Creating a Batch

```python
import anthropic

client = anthropic.Anthropic()

requests = [
    {
        "custom_id": "req-1",
        "params": {
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 1024,
            "messages": [
                {"role": "user", "content": "Classify sentiment: I love this!"}
            ],
        },
    },
    {
        "custom_id": "req-2",
        "params": {
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 1024,
            "messages": [
                {"role": "user", "content": "Classify sentiment: This is awful."}
            ],
        },
    },
]

batch = client.beta.messages.batches.create(requests=requests)
print(f"Batch ID: {batch.id}")
print(f"Status: {batch.processing_status}")
```

## Polling for Completion

```python
import time

def wait_for_batch(batch_id: str, poll_interval: int = 5):
    while True:
        batch = client.beta.messages.batches.retrieve(batch_id)
        if batch.processing_status == "ended":
            return batch
        print(f"Processing: {batch.request_counts}")
        time.sleep(poll_interval)

completed_batch = wait_for_batch(batch.id)
```

## Retrieving Results

```python
results = client.beta.messages.batches.results(batch.id)

for result in results:
    print(f"Request {result.custom_id}:")
    if result.result.type == "succeeded":
        message = result.result.message
        print(message.content[0].text)
    else:
        print(f"Error: {result.result.error.message}")
```

## Cost Savings

Batches offer approximately **50% discount** on input tokens compared to standard API calls.
