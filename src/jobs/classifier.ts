/**
 * Job Classifier - Classifies user messages into job types
 * and manages job state for template-based sessions.
 * Used by TEMPLATES feature flag.
 */
import { join, resolve } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { getClaudeConfigHomeDir } from '../utils/envUtils.js'
import { logForDebugging } from '../utils/debug.js'

const JOBS_DIR = join(getClaudeConfigHomeDir(), 'jobs')
const STATE_FILE = 'job-state.json'

export const JOB_ENV_KEY = 'CLAUDE_JOB_DIR'

/**
 * Classify a conversation turn and write state
 */
export async function classifyAndWriteState(jobDir, messages) {
  if (!jobDir || !existsSync(jobDir)) return { type: 'unknown', state: null }

  const statePath = join(jobDir, STATE_FILE)
  const state = loadJobState(jobDir)

  // Analyze messages to classify job type
  const lastMessages = messages.slice(-5)
  const textContent = lastMessages
    .filter(m => m.type === 'user')
    .map(m => typeof m.content === 'string' ? m.content : '')
    .join(' ')

  const classification = classifyMessage(textContent)

  // Update state
  state.lastClassification = classification
  state.lastUpdated = new Date().toISOString()
  state.messageCount = messages.length

  writeFileSync(statePath, JSON.stringify(state, null, 2))
  logForDebugging(`Job classified: ${classification.type} in ${jobDir}`)

  return { type: classification.type, state }
}

/**
 * Classify message content into job type
 */
function classifyMessage(text) {
  const lower = text.toLowerCase()

  if (lower.includes('bug') || lower.includes('fix') || lower.includes('error')) {
    return { type: 'bugfix', confidence: 0.8 }
  }
  if (lower.includes('test') || lower.includes('spec')) {
    return { type: 'testing', confidence: 0.8 }
  }
  if (lower.includes('refactor') || lower.includes('clean')) {
    return { type: 'refactor', confidence: 0.8 }
  }
  if (lower.includes('feature') || lower.includes('implement') || lower.includes('add')) {
    return { type: 'feature', confidence: 0.7 }
  }
  if (lower.includes('review') || lower.includes('audit')) {
    return { type: 'review', confidence: 0.8 }
  }

  return { type: 'general', confidence: 0.5 }
}

/**
 * Load job state from disk
 */
function loadJobState(jobDir) {
  const statePath = join(jobDir, STATE_FILE)
  try {
    if (existsSync(statePath)) {
      return JSON.parse(readFileSync(statePath, 'utf-8'))
    }
  } catch {
    // Ignore
  }
  return {
    type: 'unknown',
    created: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    messageCount: 0,
    lastClassification: null,
  }
}

/**
 * Get all jobs
 */
export function getAllJobs() {
  if (!existsSync(JOBS_DIR)) return []

  const jobs = []
  const entries = readdirSync(JOBS_DIR, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const jobDir = join(JOBS_DIR, entry.name)
    const statePath = join(jobDir, STATE_FILE)

    if (existsSync(statePath)) {
      try {
        const state = JSON.parse(readFileSync(statePath, 'utf-8'))
        jobs.push({
          id: entry.name,
          dir: jobDir,
          ...state,
        })
      } catch {
        // Skip malformed
      }
    }
  }

  return jobs.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated))
}

/**
 * Create a new job directory
 */
export function createJob(template) {
  const jobId = `job_${Date.now()}`
  const jobDir = join(JOBS_DIR, jobId)

  if (!existsSync(JOBS_DIR)) {
    mkdirSync(JOBS_DIR, { recursive: true })
  }

  mkdirSync(jobDir, { recursive: true })

  const state = {
    type: template?.type || 'general',
    template: template?.name || null,
    created: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    messageCount: 0,
    lastClassification: null,
  }

  writeFileSync(join(jobDir, STATE_FILE), JSON.stringify(state, null, 2))

  // Copy template files if provided
  if (template?.files) {
    for (const [name, content] of Object.entries(template.files)) {
      writeFileSync(join(jobDir, name), content)
    }
  }

  logForDebugging(`Job created: ${jobId}`)
  return { id: jobId, dir: jobDir, ...state }
}
