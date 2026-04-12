/**
 * Buddy companion command — AI companion with LLM-generated soul,
 * persistent config, and speech bubble integration.
 * Used by BUDDY feature flag.
 */

import { feature } from 'bun:bundle'
import { getCompanion, companionUserId, rollWithSeed } from './companion.js'
import { SPECIES, RARITIES, RARITY_COLORS, RARITY_STARS, type StoredCompanion } from './types.js'
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'
import { queryModelWithoutStreaming } from '../services/api/claude.js'
import { getSmallFastModel } from '../utils/model/model.js'
import { asSystemPrompt } from '../utils/systemPromptType.js'
import { createUserMessage } from '../utils/messages.js'
import { getEmptyToolPermissionContext } from '../Tool.js'
import { logForDebugging } from '../utils/debug.js'

/**
 * Generate a companion soul (name + personality) via LLM.
 * Uses bones (deterministic from userId) as inspiration seed.
 */
async function generateSoul(
  species: string,
  rarity: string,
  stats: Record<string, number>,
): Promise<{ name: string; personality: string } | null> {
  try {
    const statSummary = Object.entries(stats)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')

    const systemPrompt = `You are creating a companion soul for a tiny terminal pet.
Generate a creative name (short, 1-2 syllables) and a one-paragraph personality description.
Species: ${species}. Rarity: ${rarity}. Stats: ${statSummary}.
Make the name unique and fitting for the species. Personality should reflect the stats and rarity.
Return ONLY JSON: {"name": "...", "personality": "..."}`

    const response = await queryModelWithoutStreaming({
      messages: [createUserMessage({ content: 'Generate a companion soul.' })],
      systemPrompt: asSystemPrompt([]),
      thinkingConfig: { type: 'disabled' },
      tools: [],
      signal: AbortSignal.timeout(15_000),
      options: {
        getToolPermissionContext: async () => getEmptyToolPermissionContext(),
        model: getSmallFastModel(),
        toolChoice: undefined,
        isNonInteractiveSession: false,
        hasAppendSystemPrompt: false,
        agents: [],
        querySource: 'buddy_soul_generation',
        mcpTools: [],
        skipCacheWrite: true,
      },
    })

    if (response.isApiErrorMessage) return null

    const text = typeof response.content === 'string'
      ? response.content
      : response.content?.map(c => c.type === 'text' ? c.text : '').join('') ?? ''

    // Parse JSON from response
    const jsonMatch = text.match(/\{[^}]*\}/s)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    if (typeof parsed.name === 'string' && typeof parsed.personality === 'string') {
      return { name: parsed.name, personality: parsed.personality }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Hatch a new companion: roll bones, generate soul, save to config.
 */
async function hatchCompanion(): Promise<void> {
  const userId = companionUserId()
  const { bones, inspirationSeed } = rollWithSeed(userId + Date.now().toString())

  console.log(`Rolling a ${bones.rarity} ${bones.species}...`)

  // Generate soul via LLM
  const soul = await generateSoul(bones.species, bones.rarity, bones.stats)

  if (!soul) {
    // Fallback: generate a simple soul without LLM
    soul.name = bones.species.charAt(0).toUpperCase() + bones.species.slice(1)
    soul.personality = `A ${bones.rarity} ${bones.species} with curious eyes.`
  }

  // Store in config
  const stored: StoredCompanion = {
    name: soul.name,
    personality: soul.personality,
    hatchedAt: Date.now(),
  }

  saveGlobalConfig(cfg => ({ ...cfg, companion: stored }))

  const color = RARITY_COLORS[bones.rarity]
  const stars = RARITY_STARS[bones.rarity]

  console.log('')
  console.log(`  A new companion hatches!`)
  console.log(`  Name: ${soul.name}`)
  console.log(`  Species: ${bones.species}`)
  console.log(`  Rarity: ${stars} (${bones.rarity})`)
  console.log(`  Eye style: ${bones.eye}`)
  console.log(`  Hat: ${bones.hat !== 'none' ? bones.hat : '(none)'}`)
  if (bones.shiny) console.log(`  ✨ Shiny!`)
  console.log(`  Stats: ${Object.entries(bones.stats).map(([k, v]) => `${k}: ${v}`).join(', ')}`)
  console.log('')
  console.log(`${soul.name}: ${soul.personality}`)
  console.log('')
  console.log('Your companion is now visible beside the input bar.')
  console.log('Mute anytime with: /buddy mute')
}

/**
 * Show current companion status.
 */
function showStatus(): void {
  const companion = getCompanion()
  if (!companion) {
    console.log('No companion yet. Hatch one with: /buddy hatch')
    return
  }

  const color = RARITY_COLORS[companion.rarity]
  const stars = RARITY_STARS[companion.rarity]
  const age = Date.now() - companion.hatchedAt
  const days = Math.floor(age / (1000 * 60 * 60 * 24))
  const hours = Math.floor((age % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  console.log(`Companion: ${companion.name}`)
  console.log(`Species: ${companion.species}`)
  console.log(`Rarity: ${stars} (${companion.rarity})`)
  console.log(`Eye: ${companion.eye} | Hat: ${companion.hat !== 'none' ? companion.hat : 'none'}`)
  if (companion.shiny) console.log('✨ Shiny!')
  console.log(`Stats: ${Object.entries(companion.stats).map(([k, v]) => `${k}: ${v}`).join(', ')}`)
  console.log(`Age: ${days}d ${hours}h`)
  console.log(`Personality: ${companion.personality}`)
}

/**
 * Reset (remove) companion from config.
 */
function resetCompanion(): void {
  saveGlobalConfig(cfg => {
    const { companion, ...rest } = cfg
    return rest as typeof cfg
  })
  console.log('Companion has been released. Hatch a new one with: /buddy hatch')
}

/**
 * Toggle companion mute.
 */
function toggleMute(): void {
  const config = getGlobalConfig()
  const isMuted = config.companionMuted ?? false
  saveGlobalConfig(cfg => ({ ...cfg, companionMuted: !isMuted }))
  console.log(isMuted ? 'Companion unmuted.' : 'Companion muted (speech bubbles hidden).')
}

/**
 * Interact with companion — sends message to observer for reaction.
 * Uses simple deterministic responses when LLM unavailable.
 */
async function interactWithCompanion(message: string): Promise<void> {
  const companion = getCompanion()
  if (!companion) {
    console.log('No companion yet. Hatch one with: /buddy hatch')
    return
  }

  // Store interaction in recent memory (not persisted to config to avoid bloat)
  const lower = message.toLowerCase()
  const name = companion.name.toLowerCase()

  // Direct address to companion
  if (lower.includes(name) || lower.includes('buddy')) {
    // Generate a reaction based on companion personality
    const responses = [
      `${companion.name} tilts their head and thinks about "${message.slice(0, 30)}"...`,
      `${companion.name} perks up! "${message}" — interesting!`,
      `${companion.name} considers this carefully.`,
      `${companion.name} gives a small nod.`,
    ]
    console.log(responses[Math.floor(Math.random() * responses.length)])
    return
  }

  // Pet interaction
  if (lower.includes('pet') || lower.includes('pat') || lower.includes('good')) {
    console.log(`${companion.name} wiggles happily!`)
    return
  }

  // Stats-based responses
  if (companion.stats.SNARK > 60 && (lower.includes('code') || lower.includes('bug'))) {
    console.log(`${companion.name}: "Hmm, maybe check the code before asking me?"`)
    return
  }

  if (companion.stats.PATIENCE < 30 && message.length > 100) {
    console.log(`${companion.name}: "That's a lot of words. Can you be brief?"`)
    return
  }

  // Default: acknowledge
  console.log(`${companion.name}: *listens attentively*`)
}

export default {
  name: 'buddy',
  description: 'AI companion — hatch, interact with, and manage your terminal pet',
  type: 'local',
  load: async () => {
    return async function buddyCommand(args: string[]) {
      const cmd = args[0]?.toLowerCase()

      switch (cmd) {
        case 'hatch':
        case 'init':
          await hatchCompanion()
          break

        case 'status':
          showStatus()
          break

        case 'reset':
          resetCompanion()
          break

        case 'mute':
        case 'unmute':
          toggleMute()
          break

        default:
          if (!cmd) {
            console.log('Usage: /buddy <command>')
            console.log('Commands: hatch, status, reset, mute, <message>')
            return
          }
          await interactWithCompanion(args.join(' '))
          break
      }
    }
  },
}
