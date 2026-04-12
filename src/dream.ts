/**
 * KAIROS Dream Mode - Background autonomous task processing.
 * When enabled, Claude Code can work on tasks in the background
 * while the user is away, then consolidate results when the user returns.
 */
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { getClaudeConfigHomeDir } from './utils/envUtils.js'
import { logForDebugging } from './utils/debug.js'
import { spawn } from 'child_process'

const DREAM_DIR = join(getClaudeConfigHomeDir(), 'dream')
const DREAM_QUEUE_FILE = join(DREAM_DIR, 'queue.json')
const DREAM_RESULTS_FILE = join(DREAM_DIR, 'results.json')

export interface DreamTask {
  id?: string
  description: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  queuedAt?: string
  startedAt?: string
  completedAt?: string
  result?: { summary?: string; output?: string }
  error?: string
  maxDurationMinutes?: number
}

interface DreamState {
  enabled: boolean
  queue: DreamTask[]
  results: DreamTask[]
}

let _dreamState: DreamState | null = null

/**
 * Initialize dream mode
 */
export function setupDream() {
  if (!existsSync(DREAM_DIR)) {
    mkdirSync(DREAM_DIR, { recursive: true })
  }
  _dreamState = loadDreamState()
  logForDebugging('Dream mode setup complete')
}

/**
 * Tear down dream mode
 */
export function teardownDream() {
  _dreamState = null
}

/**
 * Check if dream mode is enabled
 */
export function isDreamEnabled() {
  return _dreamState !== null && _dreamState.enabled
}

/**
 * Check if dream mode is currently active
 */
export function isDreamActive(): boolean {
  return _dreamState?.enabled ?? false
}

/**
 * Activate dream mode
 */
export function activateDream(source: string): void {
  if (!_dreamState) setupDream()
  _dreamState.enabled = true
  _dreamState.activatedBy = source
  saveDreamState(_dreamState)
  logForDebugging(`Dream mode activated by: ${source}`)
}

/**
 * Pause dream mode temporarily
 */
export function pauseDream(): void {
  if (!_dreamState) return
  _dreamState.enabled = false
  saveDreamState(_dreamState)
  logForDebugging('Dream mode paused')
}

/**
 * Load dream state
 */
function loadDreamState() {
  try {
    if (existsSync(DREAM_DIR)) {
      const configFile = join(DREAM_DIR, 'config.json')
      if (existsSync(configFile)) {
        return JSON.parse(readFileSync(configFile, 'utf-8'))
      }
    }
  } catch (err) {
    logForDebugging(`Failed to load dream state: ${err.message}`)
  }
  return { enabled: false, queue: [], results: [] }
}

/**
 * Save dream state
 */
function saveDreamState(state) {
  try {
    if (!existsSync(DREAM_DIR)) {
      mkdirSync(DREAM_DIR, { recursive: true })
    }
    writeFileSync(join(DREAM_DIR, 'config.json'), JSON.stringify(state, null, 2))
  } catch (err) {
    logForDebugging(`Failed to save dream state: ${err.message}`)
  }
}

/**
 * Queue a dream task
 */
export function queueDreamTask(task: DreamTask) {
  if (!_dreamState) setupDream()
  _dreamState.queue.push({
    ...task,
    id: `dream_${Date.now()}`,
    status: 'pending',
    queuedAt: new Date().toISOString(),
  })
  saveDreamState(_dreamState)
  logForDebugging(`Dream task queued: ${task.description}`)
}

/**
 * Process a single dream task by spawning a headless Claude Code subprocess.
 */
async function executeDreamTask(task: DreamTask): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve) => {
    const cliPath = process.env.CLAUDE_CODE_CLI || join(process.cwd(), 'cli-dev')
    const timeoutMs = (task.maxDurationMinutes || 30) * 60 * 1000

    const child = spawn(cliPath, [
      '--print',
      task.description,
      '--dangerously-skip-permissions',
    ], {
      env: { ...process.env, CLAUDE_CODE_MODE: 'dream' },
      cwd: process.cwd(),
      timeout: timeoutMs,
    })

    let output = ''
    child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString() })
    child.stderr?.on('data', (chunk: Buffer) => { output += chunk.toString() })

    child.on('close', (code: number) => {
      resolve({ output, exitCode: code ?? 1 })
    })

    child.on('error', () => {
      resolve({ output, exitCode: 1 })
    })
  })
}

/**
 * Process dream tasks
 */
export async function processDreamTasks() {
  if (!_dreamState || !_dreamState.enabled) return

  const pendingTasks = _dreamState.queue.filter(t => t.status === 'pending')
  for (const task of pendingTasks) {
    task.status = 'processing'
    task.startedAt = new Date().toISOString()
    saveDreamState(_dreamState)

    try {
      const { output, exitCode } = await executeDreamTask(task)
      task.status = exitCode === 0 ? 'completed' : 'failed'
      task.completedAt = new Date().toISOString()
      task.result = {
        summary: exitCode === 0
          ? `Task "${task.description}" completed successfully.`
          : `Task "${task.description}" failed with exit code ${exitCode}.`,
        output: output.slice(-2000), // Keep last 2000 chars
      }
      if (exitCode !== 0) {
        task.error = `Exit code ${exitCode}`
      }
    } catch (err) {
      task.status = 'failed'
      task.error = err instanceof Error ? err.message : String(err)
      task.completedAt = new Date().toISOString()
    }

    saveDreamState(_dreamState)
  }
}

/**
 * Trigger dream consolidation - merge background work results
 */
export async function triggerDreamConsolidation() {
  if (!_dreamState) return false

  const completedTasks = _dreamState.queue.filter(t => t.status === 'completed')
  if (completedTasks.length === 0) return false

  // Save results
  try {
    let results = []
    if (existsSync(DREAM_RESULTS_FILE)) {
      results = JSON.parse(readFileSync(DREAM_RESULTS_FILE, 'utf-8'))
    }
    results.push(...completedTasks.map(t => ({
      id: t.id,
      description: t.description,
      result: t.result,
      completedAt: t.completedAt,
    })))
    writeFileSync(DREAM_RESULTS_FILE, JSON.stringify(results, null, 2))
  } catch (err) {
    logForDebugging(`Failed to consolidate dream results: ${err.message}`)
    return false
  }

  // Clear completed tasks
  _dreamState.queue = _dreamState.queue.filter(t => t.status !== 'completed')
  saveDreamState(_dreamState)

  logForDebugging(`Dream consolidation complete: ${completedTasks.length} tasks merged`)
  return true
}

/**
 * Get dream state
 */
export function getDreamState() {
  if (!_dreamState) _dreamState = loadDreamState()
  return {
    active: _dreamState.enabled,
    tasks: _dreamState.queue,
    pendingCount: _dreamState.queue.filter(t => t.status === 'pending').length,
    completedCount: _dreamState.queue.filter(t => t.status === 'completed').length,
  }
}
