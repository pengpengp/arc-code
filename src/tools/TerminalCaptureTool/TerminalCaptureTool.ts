import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { execSync } from 'child_process'
import { logForDebugging } from '../../utils/debug.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z.enum(['capture', 'scroll', 'clear']).describe('Terminal action'),
    lines: z.number().optional().describe('Number of lines to capture'),
    session: z.string().optional().describe('Terminal session identifier'),
  }),
)

export const TerminalCaptureTool = buildTool({
  name: 'terminal_capture',
  description: 'Capture terminal output for analysis. Read the last N lines of the terminal panel.',
  searchHint: 'capture terminal output and screen content',
  maxResultSizeChars: 30000,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema,
  outputSchema: lazySchema(() => z.object({ success: z.boolean(), content: z.string(), lines: z.number(), session: z.string().optional() })),

  async call(args, context) {
    const { action, lines = 50, session } = args as z.infer<ReturnType<typeof inputSchema>>
    try {
      if (action === 'capture') {
        const output = execSync(`tmux capture-pane -p -S -${lines} 2>/dev/null || echo "Terminal not available"`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 })
        logForDebugging(`Terminal captured: ${lines} lines`)
        return { type: 'text' as const, content: JSON.stringify({ success: true, content: output, lines, session }) }
      }
      return { type: 'text' as const, content: JSON.stringify({ success: false, content: '', lines: 0 }) }
    } catch (err: any) {
      return { type: 'text' as const, content: JSON.stringify({ success: false, content: err.message, lines: 0 }) }
    }
  },
})
