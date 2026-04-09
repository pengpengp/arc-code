import { buildTool } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { z } from 'zod/v4'

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z.enum(['review', 'status']).describe('Review action'),
    files: z.array(z.string()).optional().describe('Files to review'),
    base_branch: z.string().optional().describe('Base branch for diff'),
  }),
)

export const ReviewArtifactTool = buildTool({
  name: 'review_artifact',
  description: 'Generate code review artifacts. Analyzes changes and produces structured review findings.',
  searchHint: 'review code changes and generate findings',
  maxResultSizeChars: 20000,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema,
  outputSchema: lazySchema(() => z.object({ success: z.boolean(), message: z.string(), findings: z.array(z.object({ type: z.string(), message: z.string() })).optional() })),

  async call(args, context) {
    const { action, files, base_branch } = args
    if (action === 'review') {
      try {
        const { runHunter } = await import('../../hunter.js')
        const result = await runHunter({ files, baseBranch: base_branch })
        return { type: 'text', content: JSON.stringify({ success: true, message: result.message, findings: result.findings || [] }) }
      } catch (err) {
        return { type: 'text', content: JSON.stringify({ success: false, message: err.message, findings: [] }) }
      }
    }
    return { type: 'text', content: JSON.stringify({ success: true, message: 'No active review.' }) }
  },
})
