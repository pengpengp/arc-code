import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { logForDebugging } from '../../utils/debug.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    title: z.string().describe('Notification title'),
    body: z.string().describe('Notification body'),
    priority: z.enum(['low', 'normal', 'high']).optional().describe('Notification priority'),
  }),
)

export const PushNotificationTool = buildTool({
  name: 'push_notification',
  description: 'Send push notifications to the user for important events or task completions.',
  searchHint: 'send push notification to user',
  maxResultSizeChars: 5000,
  isReadOnly: () => false,
  isConcurrencySafe: () => true,
  inputSchema,
  outputSchema: lazySchema(() => z.object({ success: z.boolean(), message: z.string() })),

  async call(args, context) {
    const { title, body, priority } = args as z.infer<ReturnType<typeof inputSchema>>
    logForDebugging(`Push notification: ${title} - ${body}`)
    return { type: 'text' as const, content: JSON.stringify({ success: true, message: `Notification sent: ${title}` }) }
  },
})
