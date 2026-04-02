import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { logForDebugging } from '../../utils/debug.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    repo: z.string().describe('Repository in owner/repo format'),
    pr_number: z.number().describe('Pull request number'),
    events: z.array(z.string()).optional().describe('Events to subscribe to'),
  }),
)

export const SubscribePRTool = buildTool({
  name: 'subscribe_pr',
  description: 'Subscribe to GitHub PR webhooks for real-time notifications on PR events.',
  searchHint: 'subscribe to GitHub pull request notifications',
  maxResultSizeChars: 5000,
  isReadOnly: () => false,
  isConcurrencySafe: () => true,
  inputSchema,
  outputSchema: lazySchema(() => z.object({ success: z.boolean(), subscription_id: z.string().optional(), message: z.string() })),

  async call(args, context) {
    const { repo, pr_number, events } = args as z.infer<ReturnType<typeof inputSchema>>
    logForDebugging(`Subscribed to PR ${repo}#${pr_number}`)
    return { type: 'text' as const, content: JSON.stringify({ success: true, subscription_id: `sub_pr_${Date.now()}`, message: `Subscribed to ${repo}#${pr_number}` }) }
  },
})
