# Batches API (TypeScript)

Submit large volumes of message requests for asynchronous processing. Batches are ideal for high-throughput, non-interactive workloads.

## When to Use Batches

- Processing thousands of documents for classification
- Bulk translation or summarization
- Offline data enrichment
- Any workload where latency doesn't matter but throughput does

## Creating a Batch

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// Each request in the batch is independent
const requests = [
  {
    custom_id: "req-1",
    params: {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        { role: "user", content: "Classify this sentiment: I love this product!" }
      ],
    },
  },
  {
    custom_id: "req-2",
    params: {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        { role: "user", content: "Classify this sentiment: This is terrible." }
      ],
    },
  },
];

// Create the batch
const batch = await anthropic.beta.messages.batches.create({
  requests,
});

console.log(`Batch created: ${batch.id}`);
console.log(`Status: ${batch.processing_status}`);
```

## Checking Batch Status

```typescript
const status = await anthropic.beta.messages.batches.retrieve(batch.id);

console.log(`Status: ${status.processing_status}`);
console.log(`Completed: ${status.request_counts.succeeded}`);
console.log(`Failed: ${status.request_counts.errored}`);
console.log(`Total: ${status.request_counts.total}`);
```

## Polling for Completion

```typescript
async function waitForBatch(
  batchId: string,
  pollIntervalMs = 5000,
): Promise<Anthropic.MessageBatch> {
  while (true) {
    const batch = await anthropic.beta.messages.batches.retrieve(batchId);

    if (batch.processing_status === "ended") {
      return batch;
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
}

const completed = await waitForBatch(batch.id);
```

## Retrieving Results

```typescript
const results = await anthropic.beta.messages.batches.results(batch.id);

for (const result of results) {
  console.log(`Request ${result.custom_id}:`);
  if (result.result.type === "succeeded") {
    const message = result.result.message;
    console.log(message.content[0].text);
  } else {
    console.error(`Error: ${result.result.error?.message}`);
  }
}
```

## Batch Limits

- **Maximum requests per batch:** Check current API documentation
- **Supported models:** All Claude models
- **Processing time:** Typically faster than individual API calls due to internal batching

## Cost Considerations

- Batches typically offer a **50% discount** on input tokens compared to the standard API
- Output tokens are charged at the standard rate
- Failed requests are not charged
