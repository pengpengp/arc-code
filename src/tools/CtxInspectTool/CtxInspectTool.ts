/**
 * CtxInspectTool - Context Window Inspection Tool.
 * Allows the agent to inspect current context window usage,
 * understand token distribution across categories, and get
 * recommendations for optimizing context usage.
 *
 * Integrates with:
 * - analyzeContext.ts for token counting and breakdown
 * - contextCollapse service for collapse stats
 * - autoCompact service for threshold info
 */
import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { getContextWindowForModel } from '../../utils/context.js'
import { getSdkBetas } from '../../bootstrap/state.js'
import {
  getEffectiveContextWindowSize,
  isAutoCompactEnabled,
  AUTOCOMPACT_BUFFER_TOKENS,
  MANUAL_COMPACT_BUFFER_TOKENS,
} from '../../services/compact/autoCompact.js'
import { formatTokens } from '../../utils/format.js'
import { plural } from '../../utils/stringUtils.js'

const CTX_INSPECT_TOOL_NAME = 'ctx_inspect'

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z
      .enum(['status', 'breakdown', 'suggestions', 'collapse_stats'])
      .describe(
        "Action to perform: 'status' for overview, 'breakdown' for detailed token breakdown, 'suggestions' for optimization tips, 'collapse_stats' for context collapse statistics",
      ),
  }),
)

const outputSchema = lazySchema(() =>
  z.object({
    action: z.string(),
    totalTokens: z.number().describe('Total tokens currently used'),
    maxTokens: z.number().describe('Maximum context window size'),
    percentage: z.number().describe('Percentage of context used'),
    freeTokens: z.number().describe('Remaining free tokens'),
    details: z.string().describe('Detailed breakdown or suggestions'),
    autoCompactEnabled: z.boolean(),
    autoCompactThreshold: z.number().optional(),
  }),
)

export const CtxInspectTool = buildTool({
  name: CTX_INSPECT_TOOL_NAME,
  description:
    'Inspect the current context window usage, token distribution, and get optimization suggestions.',
  searchHint: 'inspect context window usage and tokens',
  maxResultSizeChars: 20000,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema,
  outputSchema,

  async call(args, context) {
    const { action } = args
    const appState = context.getAppState()
    const messages = appState.messages || []
    const model = appState.model || 'claude-sonnet-4-20250514'

    // Get context window size
    const contextWindow = getContextWindowForModel(model, getSdkBetas())
    const effectiveWindow = getEffectiveContextWindowSize(contextWindow)

    // Estimate message tokens (rough estimation)
    let totalMessageTokens = 0
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        // Rough estimation: ~1.3 chars per token for English
        totalMessageTokens += Math.ceil(msg.content.length / 1.3)
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'text' && typeof block.text === 'string') {
            totalMessageTokens += Math.ceil(block.text.length / 1.3)
          } else if (block.type === 'tool_use') {
            totalMessageTokens += 50 // rough estimate for tool use blocks
          } else if (block.type === 'tool_result') {
            const textContent = Array.isArray(block.content)
              ? block.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
              : typeof block.content === 'string' ? block.content : ''
            totalMessageTokens += Math.ceil(textContent.length / 1.3)
          }
        }
      }
    }

    // System prompt estimate
    const systemPromptEstimate = 3000 // rough estimate for system prompt + tools

    const totalTokens = totalMessageTokens + systemPromptEstimate
    const freeTokens = Math.max(0, effectiveWindow - totalTokens)
    const percentage = Math.round((totalTokens / effectiveWindow) * 100)

    // Auto-compact info
    const autoCompactEnabled = isAutoCompactEnabled()
    const autoCompactThreshold = effectiveWindow - AUTOCOMPACT_BUFFER_TOKENS

    let details = ''

    switch (action) {
      case 'status': {
        details = [
          `Context Window: ${formatTokens(totalTokens)} / ${formatTokens(effectiveWindow)} (${percentage}%)`,
          `Free Tokens: ${formatTokens(freeTokens)}`,
          `Model: ${model}`,
          `Auto-Compact: ${autoCompactEnabled ? 'enabled' : 'disabled'}`,
          autoCompactEnabled
            ? `Auto-Compact Threshold: ${formatTokens(autoCompactThreshold)}`
            : '',
          '',
          'Use action=breakdown for detailed token distribution.',
          'Use action=suggestions for optimization tips.',
          'Use action=collapse_stats for context collapse statistics.',
        ].filter(Boolean).join('\n')
        break
      }

      case 'breakdown': {
        // Count message types
        let userMsgs = 0, assistantMsgs = 0, toolCalls = 0, toolResults = 0
        let userTokens = 0, assistantTokens = 0, toolCallTokens = 0, toolResultTokens = 0

        for (const msg of messages) {
          if (msg.role === 'user') {
            userMsgs++
            const text = typeof msg.content === 'string' ? msg.content : ''
            userTokens += Math.ceil(text.length / 1.3)
          } else if (msg.role === 'assistant') {
            assistantMsgs++
            if (Array.isArray(msg.content)) {
              for (const block of msg.content) {
                if (block.type === 'text') {
                  assistantTokens += Math.ceil((block.text || '').length / 1.3)
                } else if (block.type === 'tool_use') {
                  toolCalls++
                  toolCallTokens += 50
                }
              }
            }
          } else if (msg.role === 'user' && Array.isArray(msg.content)) {
            // Tool results come as user messages with tool_result content
            for (const block of msg.content) {
              if (block.type === 'tool_result') {
                toolResults++
                const textContent = Array.isArray(block.content)
                  ? block.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
                  : typeof block.content === 'string' ? block.content : ''
                toolResultTokens += Math.ceil(textContent.length / 1.3)
              }
            }
          }
        }

        details = [
          '=== Context Token Breakdown ===',
          '',
          `System Prompt + Tools:  ~${formatTokens(systemPromptEstimate)} tokens`,
          `User Messages (${userMsgs}):      ${formatTokens(userTokens)} tokens`,
          `Assistant Messages (${assistantMsgs}): ${formatTokens(assistantTokens)} tokens`,
          `Tool Calls (${toolCalls}):        ${formatTokens(toolCallTokens)} tokens`,
          `Tool Results (${toolResults}):    ${formatTokens(toolResultTokens)} tokens`,
          '',
          `Total: ${formatTokens(totalTokens)} / ${formatTokens(effectiveWindow)} (${percentage}%)`,
          `Free:  ${formatTokens(freeTokens)}`,
        ].join('\n')
        break
      }

      case 'suggestions': {
        const suggestions: string[] = []

        if (percentage > 80) {
          suggestions.push('⚠️ Context usage is high (>80%). Consider:')
          if (autoCompactEnabled) {
            suggestions.push('  - Auto-compact will trigger soon')
          } else {
            suggestions.push('  - Use /compact to manually compact the conversation')
          }
          suggestions.push('  - Start a new conversation with /clear')
        } else if (percentage > 60) {
          suggestions.push('ℹ️ Context usage is moderate (60-80%).')
          suggestions.push('  - You have room for more conversation')
          if (!autoCompactEnabled) {
            suggestions.push('  - Consider enabling auto-compact for long sessions')
          }
        } else {
          suggestions.push('✅ Context usage is healthy (<60%).')
          suggestions.push('  - Plenty of room for conversation')
        }

        if (toolCalls > 20) {
          suggestions.push(`  - You've made ${toolCalls} tool calls. Consider batching operations.`)
        }

        if (toolResultTokens > totalTokens * 0.4) {
          suggestions.push('  - Tool results take up significant context. Consider summarizing results.')
        }

        suggestions.push('')
        suggestions.push('Tips to optimize context:')
        suggestions.push('  - Use /snip to remove old messages')
        suggestions.push('  - Use focused, specific prompts')
        suggestions.push('  - Avoid loading large files into context')
        suggestions.push('  - Use /compact for periodic cleanup')

        details = suggestions.join('\n')
        break
      }

      case 'collapse_stats': {
        // Get context collapse stats if available
        let collapseDetails = 'Context collapse is not enabled in this build.'
        try {
          const collapseModule = require('../../services/contextCollapse/index.js')
          if (collapseModule && collapseModule.isContextCollapseEnabled()) {
            const stats = collapseModule.getStats()
            collapseDetails = [
              `Collapsed Spans: ${stats.collapsedSpans}`,
              `Collapsed Messages: ${stats.collapsedMessages}`,
              `Staged Spans: ${stats.stagedSpans}`,
              `Total Spawns: ${stats.health.totalSpawns}`,
              `Errors: ${stats.health.totalErrors}`,
              stats.health.lastError ? `Last Error: ${stats.health.lastError.slice(0, 100)}` : '',
            ].filter(Boolean).join('\n')
          }
        } catch {
          // Collapse module not available
        }

        details = [
          '=== Context Collapse Statistics ===',
          '',
          collapseDetails,
          '',
          'Context collapse automatically summarizes older',
          'conversation spans to free up context window space.',
        ].join('\n')
        break
      }

      default:
        details = `Unknown action: ${action}. Use: status, breakdown, suggestions, or collapse_stats.`
    }

    return {
      type: 'text',
      content: JSON.stringify({
        action,
        totalTokens,
        maxTokens: effectiveWindow,
        percentage,
        freeTokens,
        details,
        autoCompactEnabled,
        autoCompactThreshold,
      }),
    }
  },
})
