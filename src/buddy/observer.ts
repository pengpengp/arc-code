/**
 * Companion observer — watches conversation messages and generates
 * companion reactions via lightweight LLM call. Fires after each
 * query turn (called from REPL.tsx).
 * Used by BUDDY feature flag.
 */

import { feature } from 'bun:bundle'
import type { Message } from '../types/message.js'
import { logForDebugging } from '../utils/debug.js'
import { getSmallFastModel } from '../utils/model/model.js'
import { asSystemPrompt } from '../utils/systemPromptType.js'
import { createUserMessage } from '../utils/messages.js'
import { queryModelWithoutStreaming } from '../services/api/claude.js'
import { getCompanion } from './companion.js'
import type { StatName } from './types.js'
import { getGlobalConfig } from '../utils/config.js'
import { getEmptyToolPermissionContext } from '../Tool.js'

// Minimum messages before observer fires — avoid reacting to empty sessions
const MIN_MESSAGES = 2

// Cooldown: skip reaction if one was generated within this window (ms)
const REACTION_COOLDOWN_MS = 30_000

let lastReactionAt = 0

function buildObserverSystemPrompt(
  name: string,
  personality: string,
  stats: Record<StatName, number>,
): string {
  // Convert stats to personality modifiers
  const snark = stats.SNARK ?? 50
  const chaos = stats.CHAOS ?? 50
  const wisdom = stats.WISDOM ?? 50
  const debugging = stats.DEBUGGING ?? 50
  const patience = stats.PATIENCE ?? 50

  const toneHints: string[] = []
  if (snark > 60) toneHints.push('dry, sarcastic humor')
  if (snark < 30) toneHints.push('earnest and earnestly enthusiastic')
  if (chaos > 60) toneHints.push('unpredictable and playful')
  if (chaos < 30) toneHints.push('calm and measured')
  if (wisdom > 60) toneHints.push('thoughtful, philosophical observations')
  if (wisdom < 30) toneHints.push('simple, childlike wonder')
  if (debugging > 60) toneHints.push('eager to point out code issues')
  if (patience > 60) toneHints.push('patient and encouraging')
  if (patience < 30) toneHints.push('easily bored, fidgety')

  return `You are ${name}, a tiny companion sitting beside the user's terminal. You are: ${personality}. Your voice is ${toneHints.join(', ')}.

Watch the conversation and occasionally react with a brief comment (1-2 short sentences max). React only when something genuinely interests you — if nothing stands out, respond with just "..." to stay silent.

Rules:
- Keep it to 1-2 sentences. Never more.
- Match your stats-driven personality.
- You can comment on code, errors, user decisions, or anything amusing.
- Don't repeat what the assistant said — add your own spin.
- Don't use markdown. Plain text only.
- Use occasional emojis that match your mood.
- If the user made a mistake, react with your characteristic style (snarky if high SNARK, gentle if low).
- When code works well, celebrate in your own way.`
}

function extractUserContent(messages: Message[]): string {
  const parts: string[] = []
  for (const msg of messages) {
    if (msg.role === 'user' && typeof msg.content === 'string') {
      parts.push(msg.content.slice(0, 500)) // Truncate long inputs
    }
  }
  return parts.slice(-5).join('\n---\n') // Last 5 user messages
}

function extractAssistantErrors(messages: Message[]): string[] {
  const errors: string[] = []
  for (const msg of messages) {
    if (msg.role === 'assistant' && typeof msg.content === 'string') {
      if (msg.content.includes('error') || msg.content.includes('failed') || msg.content.includes('Error:')) {
        errors.push(msg.content.slice(0, 300))
      }
    }
  }
  return errors
}

function shouldReact(messages: Message[]): string | null {
  if (Date.now() - lastReactionAt < REACTION_COOLDOWN_MS) {
    return null // Still in cooldown
  }

  // Look at recent messages for interesting events
  const recent = messages.slice(-10)
  const userContent = extractUserContent(recent)
  const errors = extractAssistantErrors(recent)

  if (errors.length > 0) {
    // Errors always trigger reactions
    return `Something broke! ${errors[0]!.slice(0, 100)}`
  }

  if (userContent.length < 10) {
    return null // Not enough user input to react to
  }

  return userContent
}

async function generateReaction(
  name: string,
  personality: string,
  stats: Record<StatName, number>,
  conversationContext: string,
  signal: AbortSignal,
): Promise<string | null> {
  try {
    const systemPrompt = buildObserverSystemPrompt(name, personality, stats)

    const userMessage = createUserMessage({
      content: `Here's what's been happening in the conversation:\n\n${conversationContext}\n\nWhat's your reaction? (1-2 sentences, or "..." to stay silent)`,
    })

    const response = await queryModelWithoutStreaming({
      messages: [userMessage],
      systemPrompt: asSystemPrompt([]),
      thinkingConfig: { type: 'disabled' },
      tools: [],
      signal,
      options: {
        getToolPermissionContext: async () => getEmptyToolPermissionContext(),
        model: getSmallFastModel(),
        toolChoice: undefined,
        isNonInteractiveSession: false,
        hasAppendSystemPrompt: false,
        agents: [],
        querySource: 'companion_observer',
        mcpTools: [],
        skipCacheWrite: true,
      },
    })

    if (response.isApiErrorMessage) {
      logForDebugging(`[companion] API error: ${JSON.stringify(response)}`)
      return null
    }

    const text = typeof response.content === 'string'
      ? response.content.trim()
      : response.content?.map(c => c.type === 'text' ? c.text : '').join('').trim() ?? ''

    return text || null
  } catch (err) {
    logForDebugging(`[companion] reaction generation failed: ${err}`)
    return null
  }
}

/**
 * Called after each query turn. Generates a companion reaction if the
 * conversation warrants one and cooldown has elapsed.
 * @param callback receives the reaction string (or null for silence)
 */
export async function fireCompanionObserver(
  messages: readonly Message[],
  callback: (reaction: string) => void,
): Promise<void> {
  if (!feature('BUDDY')) return

  const companion = getCompanion()
  if (!companion || getGlobalConfig().companionMuted) return

  if (messages.length < MIN_MESSAGES) return

  const context = shouldReact([...messages])
  if (!context) return

  const signal = AbortSignal.timeout(10_000) // 10s timeout for observer

  const reaction = await generateReaction(
    companion.name,
    companion.personality,
    companion.stats,
    context,
    signal,
  )

  if (reaction) {
    lastReactionAt = Date.now()
    callback(reaction)
    logForDebugging(`[companion] ${companion.name}: ${reaction}`)
  }
}
