import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import axios from 'axios'
import { getWebFetchUserAgent } from '../../utils/http.js'
import { logError } from '../../utils/log.js'

const WEB_BROWSER_TOOL_NAME = 'web_browser'

interface BrowserSession {
  url: string
  content: string
  title: string
  links: Array<{ text: string; href: string }>
  history: string[]
  historyIndex: number
}

const sessions = new Map<string, BrowserSession>()
let sessionIdCounter = 0

function createSession(): string {
  const id = 'browser_' + (++sessionIdCounter)
  sessions.set(id, { url: '', content: '', title: '', links: [], history: [], historyIndex: -1 })
  return id
}

function getSession(id: string): BrowserSession | undefined {
  return sessions.get(id)
}

function isBlockedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    const blocked = new Set(['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', 'metadata.google.internal'])
    if (blocked.has(hostname)) return true
    if (hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.') || hostname.startsWith('169.254.')) return true
    return false
  } catch { return true }
}

type TurndownCtor = typeof import('turndown')
let turndownServicePromise: Promise<InstanceType<TurndownCtor>> | undefined
function getTurndownService(): Promise<InstanceType<TurndownCtor>> {
  return (turndownServicePromise ??= import('turndown').then(m => {
    const Turndown = (m as unknown as { default: TurndownCtor }).default
    return new Turndown()
  }))
}

async function htmlToMarkdown(html: string): Promise<string> {
  const td = await getTurndownService()
  return td.turndown(html)
}

function extractLinks(html: string, baseUrl: string): Array<{ text: string; href: string }> {
  const links: Array<{ text: string; href: string }> = []
  const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gis
  let match
  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const href = new URL(match[1], baseUrl).href
      const text = match[2].replace(/<[^>]*>/g, '').trim()
      if (href && text) links.push({ text, href })
    } catch { /* skip */ }
  }
  return links.slice(0, 50)
}

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z.enum(['navigate', 'click', 'get_content', 'go_back', 'go_forward', 'close']).describe('The browser action to perform'),
    url: z.string().url().optional().describe('URL to navigate to (required for navigate)'),
    link_text: z.string().optional().describe('Text of link to click'),
    link_index: z.number().optional().describe('Index of link to click (0-based)'),
    session_id: z.string().optional().describe('Browser session ID'),
  }),
)

const outputSchema = lazySchema(() =>
  z.object({
    success: z.boolean(),
    url: z.string(),
    title: z.string(),
    content: z.string(),
    links: z.array(z.object({ text: z.string(), href: z.string() })),
    session_id: z.string(),
    error: z.string().optional(),
  }),
)

export const WebBrowserTool = buildTool({
  name: WEB_BROWSER_TOOL_NAME,
  description: 'Web browser tool to navigate, interact with, and extract content from web pages.',
  searchHint: 'browse and interact with web pages',
  maxResultSizeChars: 50000,
  isReadOnly: () => true,
  inputSchema,
  outputSchema,

  async call(args, context) {
    const start = Date.now()
    try {
      const { action, url, link_text, link_index, session_id } = args as z.infer<ReturnType<typeof inputSchema>>
      let sessionId = session_id || createSession()
      let session = getSession(sessionId)
      if (!session) { sessionId = createSession(); session = getSession(sessionId)! }

      switch (action) {
        case 'navigate': {
          if (!url) return { type: 'text' as const, content: JSON.stringify({ success: false, error: 'URL required', session_id: sessionId, url: '', title: '', content: '', links: [] }) }
          if (isBlockedUrl(url)) return { type: 'text' as const, content: JSON.stringify({ success: false, error: 'Access blocked for security', session_id: sessionId, url: '', title: '', content: '', links: [] }) }
          const response = await axios.get(url, { headers: { 'User-Agent': getWebFetchUserAgent() }, timeout: 15000, maxRedirects: 5, responseType: 'text' as const, validateStatus: (s: number) => s < 500 })
          const html = response.data
          const markdown = await htmlToMarkdown(html)
          const links = extractLinks(html, url)
          session.url = url; session.content = markdown
          session.title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.trim() || url
          session.links = links
          if (session.historyIndex < session.history.length - 1) session.history = session.history.slice(0, session.historyIndex + 1)
          session.history.push(url); session.historyIndex = session.history.length - 1
          return { type: 'text' as const, content: JSON.stringify({ success: true, url, title: session.title, content: markdown.slice(0, 10000), links: links.slice(0, 20), session_id: sessionId }) }
        }
        case 'click': {
          const link = link_index !== undefined ? session.links[link_index] : session.links.find(l => l.text.toLowerCase().includes((link_text || '').toLowerCase()))
          if (!link) return { type: 'text' as const, content: JSON.stringify({ success: false, error: 'Link not found', session_id: sessionId, url: session.url, title: session.title, content: '', links: session.links.slice(0, 20) }) }
          if (isBlockedUrl(link.href)) return { type: 'text' as const, content: JSON.stringify({ success: false, error: 'Access blocked', session_id: sessionId, url: session.url, title: session.title, content: '', links: session.links.slice(0, 20) }) }
          const response = await axios.get(link.href, { headers: { 'User-Agent': getWebFetchUserAgent() }, timeout: 15000, responseType: 'text' as const, validateStatus: (s: number) => s < 500 })
          const html = response.data; const markdown = await htmlToMarkdown(html)
          const links = extractLinks(html, link.href)
          session.url = link.href; session.content = markdown; session.title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.trim() || link.href; session.links = links
          session.history.push(link.href); session.historyIndex = session.history.length - 1
          return { type: 'text' as const, content: JSON.stringify({ success: true, url: link.href, title: session.title, content: markdown.slice(0, 10000), links: links.slice(0, 20), session_id: sessionId }) }
        }
        case 'get_content': {
          return { type: 'text' as const, content: JSON.stringify({ success: true, url: session.url, title: session.title, content: session.content.slice(0, 20000), links: session.links.slice(0, 20), session_id: sessionId }) }
        }
        case 'go_back': {
          if (session.historyIndex <= 0) return { type: 'text' as const, content: JSON.stringify({ success: false, error: 'No previous page', session_id: sessionId, url: session.url, title: session.title, content: '', links: session.links.slice(0, 20) }) }
          session.historyIndex--
          const prevUrl = session.history[session.historyIndex]
          const response = await axios.get(prevUrl, { headers: { 'User-Agent': getWebFetchUserAgent() }, timeout: 15000, responseType: 'text' as const })
          const html = response.data; session.url = prevUrl; session.content = await htmlToMarkdown(html)
          session.title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.trim() || prevUrl; session.links = extractLinks(html, prevUrl)
          return { type: 'text' as const, content: JSON.stringify({ success: true, url: prevUrl, title: session.title, content: session.content.slice(0, 10000), links: session.links.slice(0, 20), session_id: sessionId }) }
        }
        case 'go_forward': {
          if (session.historyIndex >= session.history.length - 1) return { type: 'text' as const, content: JSON.stringify({ success: false, error: 'No next page', session_id: sessionId, url: session.url, title: session.title, content: '', links: session.links.slice(0, 20) }) }
          session.historyIndex++
          const nextUrl = session.history[session.historyIndex]
          const response = await axios.get(nextUrl, { headers: { 'User-Agent': getWebFetchUserAgent() }, timeout: 15000, responseType: 'text' as const })
          const html = response.data; session.url = nextUrl; session.content = await htmlToMarkdown(html)
          session.title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.trim() || nextUrl; session.links = extractLinks(html, nextUrl)
          return { type: 'text' as const, content: JSON.stringify({ success: true, url: nextUrl, title: session.title, content: session.content.slice(0, 10000), links: session.links.slice(0, 20), session_id: sessionId }) }
        }
        case 'close': {
          sessions.delete(sessionId)
          return { type: 'text' as const, content: JSON.stringify({ success: true, url: '', title: 'Session closed', content: '', links: [], session_id: sessionId }) }
        }
        default:
          return { type: 'text' as const, content: JSON.stringify({ success: false, error: 'Unknown action: ' + action, session_id: sessionId, url: '', title: '', content: '', links: [] }) }
      }
    } catch (error: any) {
      logError(error)
      return { type: 'text' as const, content: JSON.stringify({ success: false, error: error.message || 'Browser action failed', url: '', title: '', content: '', links: [], session_id: (args as any)?.session_id || '' }) }
    }
  },
})
