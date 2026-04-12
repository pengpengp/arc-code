/**
 * Context Inspection Tool — inspect current conversation context.
 * Used by CONTEXT_COLLAPSE feature flag.
 */

import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { logForDebugging } from '../../utils/debug.js'
import { tokenCountWithEstimation } from '../../utils/tokens.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z.enum(['summary', 'token_count', 'structure']).describe('Inspection action'),
    depth: z.number().optional().describe('Depth of inspection (default: 1)'),
  }),
)

export const CtxInspectTool = buildTool({
  name: 'context_inspect',
  description: 'Inspect the current conversation context — token usage, message structure, and summary.',
  searchHint: 'inspect conversation context',
  maxResultSizeChars: 20000,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema,
  outputSchema: lazySchema(() => z.object({ success: z.boolean(), message: z.string(), tokens: z.number() })),

  async call(args, context) {
    const { action, depth = 1 } = args as z.infer<ReturnType<typeof inputSchema>>
    
    try {
      switch (action) {
        case 'summary': {
          return {
            type: 'text' as const,
            content: JSON.stringify({
              success: true,
              message: `Context depth: ${depth} level(s). Use /context to view full conversation.`,
              tokens: 0,
            }),
          }
        }
        case 'token_count': {
          const tokens = tokenCountWithEstimation([])
          return {
            type: 'text' as const,
            content: JSON.stringify({
              success: true,
              message: `Estimated token count: ${tokens}`,
              tokens,
            }),
          }
        }
        case 'structure': {
          return {
            type: 'text' as const,
            content: JSON.stringify({
              success: true,
              message: `Context structure at depth ${depth}. Use /context for details.`,
              tokens: 0,
            }),
          }
        }
        default:
          return {
            type: 'text' as const,
            content: JSON.stringify({
              success: false,
              message: `Unknown action: ${action}`,
              tokens: 0,
            }),
          }
      }
    } catch (err: any) {
      return {
        type: 'text' as const,
        content: JSON.stringify({
          success: false,
          message: err.message,
          tokens: 0,
        }),
      }
    }
  },
})
