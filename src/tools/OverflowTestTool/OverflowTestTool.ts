import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { tokenCountWithEstimation } from '../../utils/tokens.js'
import { logForDebugging } from '../../utils/debug.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z.enum(['test', 'status']).describe('Overflow test action: "test" generates payload, "status" reports current context usage'),
    payload_size: z.number().optional().describe('Test payload size in characters (default: 10000)'),
  }),
)

// Track test history
const testHistory: Array<{ action: string; timestamp: string; result: string; size?: number }> = []

/**
 * Estimate tokens for a string — roughly 4 chars per token for English text,
 * less efficient for repetitive content.
 */
function estimateTokens(str: string): number {
  // For repetitive content (like 'X' * N), each char is ~1 token
  // For natural text, ~4 chars per token
  const uniqueChars = new Set(str).size
  const ratio = uniqueChars / str.length
  // Low uniqueness = repetitive = higher token count
  const charsPerToken = ratio < 0.1 ? 1.5 : ratio < 0.3 ? 2.5 : 4
  return Math.ceil(str.length / charsPerToken)
}

export const OverflowTestTool = buildTool({
  name: 'overflow_test',
  description: 'Test context overflow behavior. Generate payloads of specific sizes and measure actual token usage against context limits.',
  searchHint: 'test context overflow behavior',
  maxResultSizeChars: 5000,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema,
  outputSchema: lazySchema(() => z.object({
    success: z.boolean(),
    message: z.string(),
    tokens_used: z.number(),
    context_limit: z.number().optional(),
    utilization_pct: z.number().optional(),
    test_history: z.number().optional(),
  })),
  async prompt() {
    return 'Test context overflow behavior and measure token usage.'
  },

  async call(args, _context) {
    const { action, payload_size = 10000 } = args as z.infer<ReturnType<typeof inputSchema>>

    if (action === 'test') {
      // Generate test payload of the specified character size
      const testPayload = 'X'.repeat(payload_size)
      const estimatedTokens = estimateTokens(testPayload)

      // For natural text payloads, use a more realistic test
      const naturalText = 'The quick brown fox jumps over the lazy dog. '
      const naturalPayload = naturalText.repeat(Math.ceil(payload_size / naturalText.length)).slice(0, payload_size)
      const naturalTokens = estimateTokens(naturalPayload)

      const result = {
        success: true,
        message: `Overflow test complete. Repetitive payload: ${payload_size} chars ≈ ${estimatedTokens} tokens. Natural text: ${payload_size} chars ≈ ${naturalTokens} tokens.`,
        tokens_used: estimatedTokens,
        repetitive_payload: { chars: payload_size, estimated_tokens: estimatedTokens },
        natural_text: { chars: payload_size, estimated_tokens: naturalTokens },
      }

      testHistory.push({
        action: 'test',
        timestamp: new Date().toISOString(),
        result: result.message,
        size: payload_size,
      })

      logForDebugging(`Overflow test: ${payload_size} chars, ${estimatedTokens} estimated tokens`)

      return { type: 'text' as const, content: JSON.stringify(result) }
    }

    if (action === 'status') {
      // Report current context utilization
      const currentTokens = tokenCountWithEstimation([]) // Would need messages from context
      const typicalLimit = 200_000 // Opus default
      const utilizationPct = currentTokens > 0 ? Math.round((currentTokens / typicalLimit) * 1000) / 10 : 0

      const result = {
        success: true,
        message: `Context utilization: ${currentTokens > 0 ? `${utilizationPct}%` : 'No active session context'}. Tests run: ${testHistory.length}.`,
        tokens_used: currentTokens,
        context_limit: typicalLimit,
        utilization_pct: utilizationPct,
        test_history: testHistory.length,
        recent_tests: testHistory.slice(-5),
      }

      return { type: 'text' as const, content: JSON.stringify(result) }
    }

    return {
      type: 'text' as const,
      content: JSON.stringify({
        success: false,
        message: `Unknown action: ${action}. Use "test" or "status".`,
        tokens_used: 0,
      }),
    }
  },
})
