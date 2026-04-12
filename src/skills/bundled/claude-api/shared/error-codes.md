# API Error Codes

Common error responses returned by the Anthropic Claude API and how to handle them.

## Error Response Format

All errors return a JSON object with the following structure:

```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "The request is missing a required parameter: 'model'"
  }
}
```

The `error.type` field indicates the category of error, and `error.message` provides details.

## Error Types

### `invalid_request_error` (HTTP 400)
The request is malformed or missing required parameters.

**Common causes:**
- Missing `model`, `max_tokens`, or `messages` fields
- Invalid JSON in the request body
- Invalid model ID
- `max_tokens` exceeds the model's maximum
- Message content exceeds context window

**Fix:** Validate request parameters before sending.

```python
# Example: validating before sending
if not model_id or not messages:
    raise ValueError("model and messages are required")
if max_tokens > 16384:
    max_tokens = 16384
```

### `authentication_error` (HTTP 401)
API key is missing or invalid.

**Common causes:**
- Missing `x-api-key` header
- Expired or revoked API key
- Using a test key in production

**Fix:** Verify your `ANTHROPIC_API_KEY` environment variable is set correctly.

```bash
# Test your API key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5-20251201","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
```

### `permission_error` (HTTP 403)
The API key does not have permission for the requested operation.

**Common causes:**
- API key lacks access to the requested model tier
- Organization has restrictions on model usage

**Fix:** Check your Anthropic Console permissions or contact your organization admin.

### `not_found_error` (HTTP 404)
The requested resource does not exist.

**Common causes:**
- Invalid model ID
- Incorrect API endpoint path

**Fix:** Verify the model ID against the [models documentation](models.md).

### `rate_limit_error` (HTTP 429)
You have exceeded the rate limit for requests.

**Common causes:**
- Too many requests per minute
- Exceeding token-per-minute limits

**Fix:** Implement exponential backoff and retry.

```python
import time
import random

def retry_with_backoff(func, max_retries=5):
    for attempt in range(max_retries):
        try:
            return func()
        except RateLimitError:
            wait = (2 ** attempt) + random.uniform(0, 1)
            time.sleep(wait)
    raise Exception("Max retries exceeded")
```

### `api_error` (HTTP 500)
An internal server error occurred on Anthropic's side.

**Fix:** Retry with backoff. If persistent, check [status.anthropic.com](https://status.anthropic.com) for outages.

### `overloaded_error` (HTTP 529)
Anthropic's API is temporarily overloaded.

**Fix:** Same as `api_error` -- retry with exponential backoff.

## HTTP Status Codes Summary

| Status Code | Error Type | Retry? |
|---|---|---|
| 400 | `invalid_request_error` | No (fix request) |
| 401 | `authentication_error` | No (fix auth) |
| 403 | `permission_error` | No (fix permissions) |
| 404 | `not_found_error` | No (fix request) |
| 429 | `rate_limit_error` | Yes (with backoff) |
| 500 | `api_error` | Yes (with backoff) |
| 529 | `overloaded_error` | Yes (with backoff) |

## Best Practices for Error Handling

1. **Always catch network errors** -- Timeouts, DNS failures, TLS errors
2. **Retry 429 and 5xx errors** with exponential backoff and jitter
3. **Do not retry 4xx errors** (except 429) -- fix the request instead
4. **Log error details** including request IDs (from `request-id` response header)
5. **Set reasonable timeouts** -- 60-120 seconds for streaming responses
6. **Use circuit breakers** in production to avoid cascading failures

## SDK Error Classes (TypeScript)

```typescript
import {
  BadRequestError,
  AuthenticationError,
  PermissionDeniedError,
  NotFoundError,
  RateLimitError,
  InternalServerError,
} from "@anthropic-ai/sdk";

try {
  const response = await client.messages.create({ ... });
} catch (error) {
  if (error instanceof RateLimitError) {
    // retry with backoff
  } else if (error instanceof AuthenticationError) {
    // check API key
  } else if (error instanceof BadRequestError) {
    // fix request parameters
  }
}
```
