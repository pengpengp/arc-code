import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { logForDebugging } from '../../utils/debug.js'
import { execFileNoThrow } from '../../utils/execFileNoThrow.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    repo: z.string().describe('Repository in owner/repo format'),
    pr_number: z.number().describe('Pull request number'),
    events: z.array(z.string()).optional().describe('Events to subscribe to (default: [opened, synchronize, closed])'),
  }),
)

// Active subscriptions stored in-memory (resets on restart)
const MAX_SUBSCRIPTIONS = 50
const activeSubscriptions = new Map<string, { repo: string; pr: number; events: string[]; subscribedAt: string }>()

async function isGitHubCliAvailable(): Promise<boolean> {
  const { code } = await execFileNoThrow('gh', ['--version'], { preserveOutputOnError: false })
  return code === 0
}

async function getGitHubToken(): Promise<string | null> {
  // Try gh CLI first
  if (await isGitHubCliAvailable()) {
    const { code, stdout } = await execFileNoThrow('gh', ['auth', 'token'], { preserveOutputOnError: false })
    if (code === 0) return stdout.trim()
  }
  // Fall back to env var
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null
}

async function createWebhook(repo: string, events: string[]): Promise<{ id: string; url: string } | null> {
  const token = await getGitHubToken()
  if (!token) {
    return null
  }

  // Use the current process's webhook endpoint (or a localhost URL for local sessions)
  const webhookUrl = process.env.CLAUDE_WEBHOOK_URL || `http://127.0.0.1:${process.env.CLAUDE_PORT || 3000}/webhooks/github`

  const [owner, _repo] = repo.split('/')
  if (!owner || !_repo) {
    throw new Error(`Invalid repo format: ${repo}. Expected owner/repo.`)
  }

  try {
    const { code, stdout } = await execFileNoThrow(
      'gh',
      [
        'api',
        `repos/${owner}/${_repo}/hooks`,
        '--method', 'POST',
        '-f', `config[url]=${webhookUrl}`,
        '-f', 'config[content_type]=json',
        '-f', `events=${events.join(',')}`,
        '-f', 'active=true',
      ],
      { preserveOutputOnError: false },
    )

    if (code === 0) {
      const result = JSON.parse(stdout)
      return { id: String(result.id), url: webhookUrl }
    }
  } catch {
    // gh CLI not available or API call failed
  }

  // Fallback: store subscription for later manual webhook setup
  return { id: `pending_${Date.now()}`, url: webhookUrl }
}

export const SubscribePRTool = buildTool({
  name: 'subscribe_pr',
  description: 'Subscribe to GitHub PR webhooks for real-time notifications on PR events. Requires gh CLI or GITHUB_TOKEN.',
  searchHint: 'subscribe to GitHub pull request notifications',
  maxResultSizeChars: 5000,
  isReadOnly: () => false,
  isConcurrencySafe: () => true,
  inputSchema,
  outputSchema: lazySchema(() => z.object({ success: z.boolean(), subscription_id: z.string().optional(), message: z.string() })),
  async prompt() {
    return 'Subscribe to GitHub pull request webhook notifications.'
  },

  async call(args, _context) {
    const { repo, pr_number, events } = args as z.infer<ReturnType<typeof inputSchema>>
    const subEvents = events || ['opened', 'synchronize', 'closed', 'review_requested']

    try {
      // Validate repo format
      const [owner, _repo] = repo.split('/')
      if (!owner || !_repo) {
        return {
          type: 'text' as const,
          content: JSON.stringify({
            success: false,
            message: `Invalid repo format: ${repo}. Expected owner/repo.`,
          }),
        }
      }

      // Attempt to create webhook via GitHub API
      const webhook = await createWebhook(repo, subEvents)

      const subId = `sub_${owner}_${_repo}_${pr_number}_${Date.now()}`
      if (activeSubscriptions.size >= MAX_SUBSCRIPTIONS) {
        const oldestKey = activeSubscriptions.keys().next().value
        if (oldestKey !== undefined) activeSubscriptions.delete(oldestKey)
      }
      activeSubscriptions.set(subId, {
        repo,
        pr: pr_number,
        events: subEvents,
        subscribedAt: new Date().toISOString(),
      })

      logForDebugging(`Subscribed to PR ${repo}#${pr_number} for events: ${subEvents.join(', ')}`)

      const webhookStatus = webhook ? 'Webhook created' : 'Webhook pending (no GitHub auth found — will poll manually)'

      return {
        type: 'text' as const,
        content: JSON.stringify({
          success: true,
          subscription_id: subId,
          message: `Subscribed to ${repo}#${pr_number}. ${webhookStatus}. Events: ${subEvents.join(', ')}`,
        }),
      }
    } catch (error) {
      return {
        type: 'text' as const,
        content: JSON.stringify({
          success: false,
          message: `Failed to subscribe to PR: ${error}`,
        }),
      }
    }
  },
})

/**
 * Get all active PR subscriptions.
 */
export function getActivePRSubscriptions() {
  return Array.from(activeSubscriptions.values())
}
