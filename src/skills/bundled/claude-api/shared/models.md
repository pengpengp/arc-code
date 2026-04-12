# Claude Models

This document lists the current Claude models available through the Anthropic API, including context windows, pricing guidance, and recommended use cases.

## Current Model Lineup

### Claude Opus 4.6
- **Model ID:** `claude-opus-4-6-20260101`
- **Context window:** 200,000 tokens
- **Max output:** 16,384 tokens
- **Best for:** Complex reasoning, multi-step analysis, research, legal/medical review, advanced coding tasks
- **Relative cost:** Highest tier
- **Latency:** Higher than Sonnet; use when quality matters most

### Claude Sonnet 4.6
- **Model ID:** `claude-sonnet-4-6-20260101`
- **Context window:** 200,000 tokens
- **Max output:** 16,384 tokens
- **Best for:** General-purpose applications, coding, data extraction, summarization, customer support
- **Relative cost:** Mid-tier (best price/performance ratio)
- **Latency:** Fast; good balance of speed and quality

### Claude Haiku 4.5
- **Model ID:** `claude-haiku-4-5-20251201`
- **Context window:** 200,000 tokens
- **Max output:** 8,192 tokens
- **Best for:** High-volume tasks, classification, simple extraction, chat moderation, real-time applications
- **Relative cost:** Lowest tier
- **Latency:** Fastest model; ideal for latency-sensitive applications

### Claude Sonnet 3.5
- **Model ID:** `claude-sonnet-3-5-20241022`
- **Context window:** 200,000 tokens
- **Max output:** 8,192 tokens
- **Best for:** Legacy applications, cost-sensitive workloads where Sonnet 4.x is not needed
- **Relative cost:** Lower than Sonnet 4.x
- **Note:** Earlier generation; prefer Sonnet 4.6 for new projects

## Model Selection Guide

| Use Case | Recommended Model |
|---|---|
| Complex reasoning & analysis | Opus 4.6 |
| General coding & development | Sonnet 4.6 |
| High-volume/simple tasks | Haiku 4.5 |
| Agentic workflows | Sonnet 4.6 or Opus 4.6 |
| Real-time chat | Haiku 4.5 |
| Document summarization | Sonnet 4.6 |
| Data extraction | Sonnet 4.6 or Haiku 4.5 |
| Multi-step planning | Opus 4.6 |

## Pricing Model

Pricing is per million tokens, with separate rates for input and output:
- **Input tokens:** Charged per token in the prompt (messages, system prompt, tools)
- **Output tokens:** Charged per token in Claude's response
- **Cache reads:** Reduced rate for cached prefix reads (see [prompt-caching.md](prompt-caching.md))
- **Cache writes:** One-time cost to write to cache

For current pricing, visit [docs.anthropic.com/en/docs/build-with-claude/pricing](https://docs.anthropic.com/en/docs/build-with-claude/pricing).

## Model ID Format

Model IDs follow the pattern: `claude-{family}-{version}-{date}`

- **family:** `opus`, `sonnet`, or `haiku`
- **version:** Generation number (e.g., `4-6`, `4-5`, `3-5`)
- **date:** Release date in YYYYMMDD format

Always verify model IDs against the [Anthropic documentation](https://docs.anthropic.com) as they change over time.
