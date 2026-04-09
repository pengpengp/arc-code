/**
 * KAIROS Assistant Mode - Persistent AI assistant with session memory.
 * Provides a daily-log style assistant that remembers conversations,
 * tracks tasks, and maintains context across sessions.
 *
 * This is a full implementation based on the arc-code architecture.
 */
import { join, resolve } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { getClaudeConfigHomeDir } from '../utils/envUtils.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/growthbook.js'
import { logEvent } from '../services/analytics/index.js'
import { logForDebugging } from '../utils/debug.js'

const ASSISTANT_DIR = join(getClaudeConfigHomeDir(), 'assistant')
const SESSIONS_FILE = join(ASSISTANT_DIR, 'sessions.json')
const MEMORY_FILE = join(ASSISTANT_DIR, 'memory.json')

let _assistantForced = false
let _assistantTeamContext = null
let _assistantMemory = null

/**
 * Check if assistant mode is active
 */
export function isAssistantMode() {
  // For arc-code builds, always enable assistant mode
  if (process.env.USER_TYPE !== 'ant') {
    return true
  }
  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_kairos', false) || _assistantForced
}

/**
 * Mark assistant as forced (via --assistant flag)
 */
export function markAssistantForced() {
  _assistantForced = true
}

/**
 * Check if assistant was forced via CLI flag
 */
export function isAssistantForced() {
  return _assistantForced
}

/**
 * Get the assistant system prompt addendum
 */
export function getAssistantSystemPromptAddendum() {
  return `You are in Assistant mode. You have persistent memory across sessions.
You maintain a daily log of tasks, decisions, and progress.
When the user asks about previous work, check your memory first.
Always be helpful, thorough, and maintain context from previous conversations.`
}

/**
 * Initialize the assistant team context
 */
export async function initializeAssistantTeam() {
  if (_assistantTeamContext) return _assistantTeamContext

  // Ensure assistant directory exists
  if (!existsSync(ASSISTANT_DIR)) {
    mkdirSync(ASSISTANT_DIR, { recursive: true })
  }

  // Load memory
  _assistantMemory = loadMemory()

  _assistantTeamContext = {
    memory: _assistantMemory,
    sessions: loadSessions(),
    teamMembers: [],
    initialized: true,
  }

  logForDebugging('Assistant team initialized')
  return _assistantTeamContext
}

/**
 * Load assistant memory from disk
 */
function loadMemory() {
  try {
    if (existsSync(MEMORY_FILE)) {
      return JSON.parse(readFileSync(MEMORY_FILE, 'utf-8'))
    }
  } catch (err) {
    logForDebugging(`Failed to load assistant memory: ${err.message}`)
  }
  return {
    entries: [],
    tasks: [],
    notes: [],
    lastUpdated: new Date().toISOString(),
  }
}

/**
 * Save assistant memory to disk
 */
export function saveMemory(memory) {
  try {
    if (!existsSync(ASSISTANT_DIR)) {
      mkdirSync(ASSISTANT_DIR, { recursive: true })
    }
    memory.lastUpdated = new Date().toISOString()
    writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2))
  } catch (err) {
    logForDebugging(`Failed to save assistant memory: ${err.message}`)
  }
}

/**
 * Load sessions from disk
 */
function loadSessions() {
  try {
    if (existsSync(SESSIONS_FILE)) {
      return JSON.parse(readFileSync(SESSIONS_FILE, 'utf-8'))
    }
  } catch (err) {
    logForDebugging(`Failed to load sessions: ${err.message}`)
  }
  return []
}

/**
 * Save sessions to disk
 */
export function saveSessions(sessions) {
  try {
    if (!existsSync(ASSISTANT_DIR)) {
      mkdirSync(ASSISTANT_DIR, { recursive: true })
    }
    writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2))
  } catch (err) {
    logForDebugging(`Failed to save sessions: ${err.message}`)
  }
}

/**
 * Add a memory entry
 */
export function addMemoryEntry(entry) {
  if (!_assistantMemory) _assistantMemory = loadMemory()
  _assistantMemory.entries.push({
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
    id: entry.id || `mem_${Date.now()}`,
  })
  saveMemory(_assistantMemory)
}

/**
 * Search memory entries
 */
export function searchMemory(query, limit = 10) {
  if (!_assistantMemory) _assistantMemory = loadMemory()
  const q = query.toLowerCase()
  return _assistantMemory.entries
    .filter(e =>
      (e.content || '').toLowerCase().includes(q) ||
      (e.title || '').toLowerCase().includes(q) ||
      (e.tags || []).some(t => t.toLowerCase().includes(q))
    )
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit)
}

/**
 * Get recent memory entries
 */
export function getRecentMemory(hours = 24, limit = 20) {
  if (!_assistantMemory) _assistantMemory = loadMemory()
  const cutoff = new Date(Date.now() - hours * 3600000)
  return _assistantMemory.entries
    .filter(e => new Date(e.timestamp) >= cutoff)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit)
}

/**
 * Get assistant session directory
 */
export function getAssistantDir() {
  return ASSISTANT_DIR
}

/**
 * Check if assistant settings are valid
 */
export function validateAssistantSettings() {
  const errors = []
  if (!existsSync(ASSISTANT_DIR)) {
    errors.push({ field: 'dir', message: 'Assistant directory not found' })
  }
  return errors
}

export default {
  name: 'assistant',
  description: 'Open persistent AI assistant mode',
  type: 'local',
  load: async () => {
    return async function assistantCommand() {
      // Assistant command handled by main.tsx routing
    }
  },
}
