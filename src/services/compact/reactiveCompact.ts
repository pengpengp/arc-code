/**
 * Reactive Compact — on-demand context compaction triggered by
 * prompt-too-long (HTTP 413) errors from the API.
 * Used by REACTIVE_COMPACT feature flag.
 *
 * Unlike proactive auto-compact, reactive compact only fires when the
 * API rejects a request due to context overflow, then summarizes the
 * conversation to fit within limits and retries.
 */

import type { Message } from '../../types/message.js'
import type { CacheSafeParams } from '../../utils/forkedAgent.js'
import { logForDebugging } from '../../utils/debug.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../analytics/growthbook.js'

export type CompactTrigger = 'manual' | 'auto'

export type ReactiveCompactOptions = {
  customInstructions: string
  trigger: CompactTrigger
}

export type ReactiveCompactResult = {
  ok: true
  result: {
    newMessages: Message[]
    userDisplayMessage?: string
  }
} | {
  ok: false
  reason: 'too_few_groups' | 'aborted' | 'exhausted' | 'error' | 'media_unstrippable'
}

export type TryReactiveCompactParams = {
  hasAttempted: boolean
  querySource: string
  aborted: boolean
  messages: Message[]
  cacheSafeParams: CacheSafeParams
}

/**
 * Check if reactive compact mode is enabled via GrowthBook.
 */
export function isReactiveCompactEnabled(): boolean {
  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_cobalt_raccoon', false)
}

/**
 * Check if the session is in reactive-only mode (suppress proactive auto-compact).
 */
export function isReactiveOnlyMode(): boolean {
  return isReactiveCompactEnabled()
}

/**
 * Check if a withheld error message indicates a prompt-too-long error.
 */
export function isWithheldPromptTooLong(msg: Message | undefined): boolean {
  if (!msg || msg.type !== 'system_api_error') return false
  const reason = (msg as any).reason
  return reason === 'prompt_too_long'
}

/**
 * Check if a withheld error message indicates a media size error.
 */
export function isWithheldMediaSizeError(msg: Message | undefined): boolean {
  if (!msg || msg.type !== 'system_api_error') return false
  const reason = (msg as any).reason
  return reason === 'image_error' || reason === 'media_error'
}

/**
 * Attempt reactive compaction when the API returns a prompt-too-long error.
 * Called from the query loop (query.ts).
 */
export async function tryReactiveCompact(params: TryReactiveCompactParams): Promise<{ newMessages: Message[]; userDisplayMessage?: string } | null> {
  const { hasAttempted, aborted, messages } = params

  if (aborted) return null
  if (hasAttempted) return null

  logForDebugging('[reactiveCompact] Attempting reactive compact...')

  try {
    const result = await reactiveCompactOnPromptTooLong(
      messages,
      params.cacheSafeParams,
      { customInstructions: '', trigger: 'auto' },
    )

    if (!result.ok) {
      logForDebugging(`[reactiveCompact] Failed: ${result.reason}`)
      return null
    }

    logForDebugging('[reactiveCompact] Compaction successful')
    return result.result
  } catch (err) {
    logForDebugging(`[reactiveCompact] Error: ${err}`)
    return null
  }
}

/**
 * Perform reactive compaction: summarize conversation and return compacted messages.
 * Uses the standard compactConversation path with pre/post hooks.
 */
export async function reactiveCompactOnPromptTooLong(
  messages: Message[],
  cacheSafeParams: CacheSafeParams,
  options: ReactiveCompactOptions,
): Promise<ReactiveCompactResult> {
  try {
    // Import here to avoid circular deps
    const { executePreCompactHooks } = await import('../../utils/hooks.js')
    const { compactConversation, mergeHookInstructions } = await import('./compact.js')
    const { suppressCompactWarning } = await import('./compactWarningState.js')
    const { runPostCompactCleanup } = await import('./postCompactCleanup.js')

    const signal = AbortSignal.timeout(60_000)

    // Run pre-compact hooks
    const hookResult = await executePreCompactHooks(
      { trigger: options.trigger, customInstructions: options.customInstructions || null },
      signal,
    )

    const mergedInstructions = mergeHookInstructions(
      options.customInstructions,
      hookResult.newCustomInstructions,
    )

    // Run compaction
    const compactionResult = await compactConversation(
      messages,
      cacheSafeParams.systemPrompt,
      { customInstructions: mergedInstructions, trigger: options.trigger },
      signal,
    )

    if (!compactionResult || compactionResult.newMessages.length === 0) {
      return { ok: false, reason: 'too_few_groups' }
    }

    // Run post-compact hooks
    const { executePostCompactHooks } = await import('../../utils/hooks.js')
    const postCompactResult = await executePostCompactHooks(
      compactionResult,
      { trigger: options.trigger, customInstructions: mergedInstructions },
      signal,
    )

    suppressCompactWarning()
    runPostCompactCleanup()

    const userDisplayMessage =
      [hookResult.userDisplayMessage, postCompactResult.userDisplayMessage]
        .filter(Boolean)
        .join('\n') || undefined

    return {
      ok: true,
      result: {
        ...postCompactResult,
        userDisplayMessage,
      },
    }
  } catch (err: any) {
    if (err.name === 'AbortError' || err.message?.includes('abort')) {
      return { ok: false, reason: 'aborted' }
    }
    logForDebugging(`[reactiveCompact] compact failed: ${err}`)
    return { ok: false, reason: 'error' }
  }
}
