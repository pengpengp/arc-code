/**
 * Reactive Compact - Triggers context compaction based on real-time
 * context pressure rather than fixed thresholds.
 *
 * When the prompt gets too long, this module can preemptively compact
 * the conversation before sending it to the API, preventing 413 errors.
 */
import { isAutoCompactEnabled, getEffectiveContextWindowSize } from './autoCompact.js'
import { getContextWindowForModel } from '../../utils/context.js'
import { getSdkBetas } from '../../bootstrap/state.js'
import { logForDebugging } from '../../utils/debug.js'

let _reactiveEnabled = false
let _reactiveOnlyMode = false

export function setupReactiveCompact() {
  _reactiveEnabled = true
  logForDebugging('Reactive compact setup')
}

export function teardownReactiveCompact() {
  _reactiveEnabled = false
}

export function isReactiveCompactEnabled() {
  return _reactiveEnabled && isAutoCompactEnabled()
}

export function isReactiveOnlyMode() {
  return _reactiveOnlyMode
}

export function setReactiveOnlyMode(value) {
  _reactiveOnlyMode = value
}

export function isWithheldPromptTooLong(message) {
  if (!isReactiveCompactEnabled()) return false
  const content = typeof message.content === 'string' ? message.content : ''
  return content.length > 50000
}

export async function reactiveCompactOnPromptTooLong(messages, toolUseContext, querySource) {
  if (!isReactiveCompactEnabled()) return { compacted: false, reason: 'disabled' }

  const model = toolUseContext.options.mainLoopModel
  const contextWindow = getContextWindowForModel(model, getSdkBetas())
  const effectiveWindow = getEffectiveContextWindowSize(contextWindow)

  // Estimate total tokens
  let totalTokens = 0
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      totalTokens += Math.ceil(msg.content.length / 1.3)
    }
  }

  // If we're over 90% of context window, trigger reactive compact
  if (totalTokens > effectiveWindow * 0.9) {
    logForDebugging(`Reactive compact triggered: ${totalTokens}/${effectiveWindow} tokens`)
    // In a real implementation, this would call the compact service
    return { compacted: true, reason: 'context_pressure', tokensBefore: totalTokens }
  }

  return { compacted: false, reason: 'within_limits', tokensUsed: totalTokens }
}

export function recoverFromOverflow(messages, querySource) {
  if (!isReactiveCompactEnabled()) return { committed: 0, messages }
  // In a real implementation, this would drain the overflow buffer
  return { committed: 0, messages }
}
