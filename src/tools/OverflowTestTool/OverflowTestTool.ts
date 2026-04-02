import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z.enum(['test', 'status']).describe('Overflow test action'),
    payload_size: z.number().optional().describe('Test payload size in tokens'),
  }),
)

export const OverflowTestTool = buildTool({
  name: 'overflow_test',
  description: 'Testing tool for context overflow behavior. Used to verify how the system handles large contexts.',
  searchHint: 'test context overflow behavior',
  maxResultSizeChars: 5000,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema,
  outputSchema: lazySchema(() => z.object({ success: z.boolean(), message: z.string(), tokens_used: z.number() })),

  async call(args, context) {
    const { action, payload_size = 1000 } = args as z.infer<ReturnType<typeof inputSchema>>
    if (action === 'test') {
      const testPayload = 'X'.repeat(payload_size)
      return { type: 'text' as const, content: JSON.stringify({ success: true, message: `Overflow test with ${payload_size} tokens`, tokens_used: payload_size }) }
    }
    return { type: 'text' as const, content: JSON.stringify({ success: true, message: 'No overflow issues detected.', tokens_used: 0 }) }
  },
})
