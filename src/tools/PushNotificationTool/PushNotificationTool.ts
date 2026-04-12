import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { logForDebugging } from '../../utils/debug.js'
import { execFileNoThrow } from '../../utils/execFileNoThrow.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    title: z.string().describe('Notification title'),
    body: z.string().describe('Notification body text'),
    priority: z.enum(['low', 'normal', 'high']).optional().describe('Notification priority level (default: normal)'),
  }),
)

/**
 * Send notification via available channels:
 * 1. Native OS notification (macOS: osascript, Linux: notify-send, Windows: BurntToast)
 * 2. Push service if CLAUDE_PUSH_TOKEN is set
 * 3. Terminal bell as last resort
 */
async function sendNotification(title: string, body: string, priority: string): Promise<{ delivered: boolean; channel: string; error?: string }> {
  // Try native OS notifications first
  if (process.platform === 'darwin') {
    try {
      const script = `display notification "${body.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}" sound name "Glass"`
      const { code } = await execFileNoThrow('osascript', ['-e', script], { preserveOutputOnError: false })
      if (code === 0) return { delivered: true, channel: 'macos-native' }
    } catch {
      // osascript failed
    }
  }

  if (process.platform === 'linux') {
    try {
      const { code } = await execFileNoThrow('notify-send', [title, body], { preserveOutputOnError: false })
      if (code === 0) return { delivered: true, channel: 'linux-native' }
    } catch {
      // notify-send not available
    }
  }

  if (process.platform === 'win32') {
    try {
      // PowerShell notification
      const psScript = `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null`
      const { code } = await execFileNoThrow('powershell', ['-Command', psScript], { preserveOutputOnError: false })
      if (code === 0) return { delivered: true, channel: 'windows-native' }
    } catch {
      // PowerShell notification not available
    }
  }

  // Try push service if token is configured
  if (process.env.CLAUDE_PUSH_TOKEN) {
    try {
      const { code } = await execFileNoThrow('curl', [
        '-s', '-X', 'POST',
        'https://api.pushover.net/1/messages.json',
        '-d', `token=${process.env.CLAUDE_PUSH_TOKEN}`,
        '-d', `user=${process.env.CLAUDE_PUSH_USER || ''}`,
        '-d', `title=${encodeURIComponent(title)}`,
        '-d', `message=${encodeURIComponent(body)}`,
        '-d', `priority=${priority === 'high' ? '1' : priority === 'low' ? '-1' : '0'}`,
      ], { preserveOutputOnError: false })
      if (code === 0) return { delivered: true, channel: 'pushover' }
    } catch {
      // Pushover failed
    }
  }

  // Fallback: terminal bell
  try {
    process.stdout.write(`\x07`) // Bell character
    return { delivered: true, channel: 'terminal-bell' }
  } catch {
    return { delivered: false, channel: 'none', error: 'No notification channel available' }
  }
}

export const PushNotificationTool = buildTool({
  name: 'push_notification',
  description: 'Send push notifications to the user for important events. Uses native OS notifications first, then push services, then terminal bell.',
  searchHint: 'send push notification to user',
  maxResultSizeChars: 5000,
  isReadOnly: () => false,
  isConcurrencySafe: () => true,
  inputSchema,
  outputSchema: lazySchema(() => z.object({ success: z.boolean(), channel: z.string(), message: z.string() })),

  async call(args, _context) {
    const { title, body, priority } = args as z.infer<ReturnType<typeof inputSchema>>
    const p = priority || 'normal'

    logForDebugging(`Push notification: [${p}] ${title} - ${body}`)

    try {
      const result = await sendNotification(title, body, p)

      if (result.delivered) {
        return {
          type: 'text' as const,
          content: JSON.stringify({
            success: true,
            channel: result.channel,
            message: `Notification delivered via ${result.channel}: ${title}`,
          }),
        }
      }

      return {
        type: 'text' as const,
        content: JSON.stringify({
          success: false,
          channel: 'none',
          message: `Failed to deliver notification: ${result.error}`,
        }),
      }
    } catch (error) {
      return {
        type: 'text' as const,
        content: JSON.stringify({
          success: false,
          channel: 'error',
          message: `Notification error: ${error}`,
        }),
      }
    }
  },
})
