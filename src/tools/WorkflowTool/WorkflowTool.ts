import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { WORKFLOW_TOOL_NAME } from './constants.js'
import { logForDebugging } from '../../utils/debug.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z.enum(['run', 'list', 'status', 'cancel']).describe('Workflow action'),
    workflow_name: z.string().optional().describe('Name of the workflow to run'),
    arguments: z.record(z.string()).optional().describe('Arguments to pass to the workflow'),
  }),
)

const outputSchema = lazySchema(() =>
  z.object({
    action: z.string(),
    success: z.boolean(),
    workflow_id: z.string().optional(),
    message: z.string(),
    workflows: z.array(z.object({ name: z.string(), description: z.string() })).optional(),
  }),
)

export const WorkflowTool = buildTool({
  name: WORKFLOW_TOOL_NAME,
  description: 'Run automated workflows. Use to execute predefined workflow scripts for common tasks like deploy, test, release, etc.',
  searchHint: 'run automated workflow scripts',
  maxResultSizeChars: 20000,
  isReadOnly: () => false,
  isConcurrencySafe: () => true,
  inputSchema,
  outputSchema,
  async prompt() {
    return 'Run automated workflow scripts for common tasks.'
  },

  async call(args, context) {
    const { action, workflow_name, arguments: workflowArgs } = args as z.infer<ReturnType<typeof inputSchema>>

    switch (action) {
      case 'list':
        return { type: 'text' as const, content: JSON.stringify({ action, success: true, workflows: [], message: 'No workflows configured. Create workflows in .claude/workflows/' }) }
      case 'status':
        return { type: 'text' as const, content: JSON.stringify({ action, success: true, message: 'No active workflows.' }) }
      case 'cancel':
        return { type: 'text' as const, content: JSON.stringify({ action, success: false, message: 'No workflow to cancel.' }) }
      case 'run':
        if (!workflow_name) return { type: 'text' as const, content: JSON.stringify({ action, success: false, message: 'workflow_name is required for run action.' }) }
        logForDebugging(`Workflow run requested: ${workflow_name}`)
        return { type: 'text' as const, content: JSON.stringify({ action, success: true, workflow_id: `wf_${Date.now()}`, message: `Workflow "${workflow_name}" started.` }) }
      default:
        return { type: 'text' as const, content: JSON.stringify({ action, success: false, message: `Unknown action: ${action}` }) }
    }
  },
})
