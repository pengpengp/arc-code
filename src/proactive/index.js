/**
 * PROACTIVE Mode - Claude Code takes initiative on tasks.
 * Detects issues, suggests improvements, and autonomously
 * works on tasks without explicit user prompting.
 */
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { getClaudeConfigHomeDir } from '../utils/envUtils.js'
import { logForDebugging } from '../utils/debug.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/growthbook.js'

const PROACTIVE_DIR = join(getClaudeConfigHomeDir(), 'proactive')
const INSIGHTS_FILE = join(PROACTIVE_DIR, 'insights.json')
const TASKS_FILE = join(PROACTIVE_DIR, 'tasks.json')

let _proactiveState = null

/**
 * Setup proactive mode
 */
export function setupProactive() {
  if (!existsSync(PROACTIVE_DIR)) {
    mkdirSync(PROACTIVE_DIR, { recursive: true })
  }
  _proactiveState = loadProactiveState()
  logForDebugging('Proactive mode setup complete')
}

/**
 * Tear down proactive mode
 */
export function teardownProactive() {
  _proactiveState = null
}

/**
 * Check if proactive mode is enabled
 */
export function isProactiveEnabled() {
  const gate = getFeatureValue_CACHED_MAY_BE_STALE('tengu_kairos_proactive', false)
  return gate || (_proactiveState?.enabled ?? false)
}

/**
 * Load proactive state
 */
function loadProactiveState() {
  try {
    const configFile = join(PROACTIVE_DIR, 'config.json')
    if (existsSync(configFile)) {
      return JSON.parse(readFileSync(configFile, 'utf-8'))
    }
  } catch (err) {
    logForDebugging(`Failed to load proactive state: ${err.message}`)
  }
  return { enabled: false, insights: [], tasks: [], rules: [] }
}

/**
 * Save proactive state
 */
function saveProactiveState(state) {
  try {
    if (!existsSync(PROACTIVE_DIR)) {
      mkdirSync(PROACTIVE_DIR, { recursive: true })
    }
    writeFileSync(join(PROACTIVE_DIR, 'config.json'), JSON.stringify(state, null, 2))
  } catch (err) {
    logForDebugging(`Failed to save proactive state: ${err.message}`)
  }
}

/**
 * Add a proactive insight
 */
export function addInsight(insight) {
  if (!_proactiveState) _proactiveState = loadProactiveState()
  _proactiveState.insights.push({
    ...insight,
    id: `insight_${Date.now()}`,
    timestamp: new Date().toISOString(),
    dismissed: false,
  })
  saveProactiveState(_proactiveState)
}

/**
 * Add a proactive task
 */
export function addTask(task) {
  if (!_proactiveState) _proactiveState = loadProactiveState()
  _proactiveState.tasks.push({
    ...task,
    id: `task_${Date.now()}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  })
  saveProactiveState(_proactiveState)
}

/**
 * Trigger proactive check - analyze current project state
 */
export async function triggerProactiveCheck() {
  if (!_proactiveState || !isProactiveEnabled()) return false

  const insights = []

  // Check for common issues
  // 1. Uncommitted changes
  try {
    const { execSync } = await import('child_process')
    const status = execSync('git status --porcelain', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
    if (status) {
      insights.push({
        type: 'uncommitted_changes',
        severity: 'info',
        message: `You have ${status.split('\n').length} uncommitted file(s). Consider committing your work.`,
        suggestion: 'Run /commit to save your progress.',
      })
    }
  } catch {
    // Not a git repo or git not available
  }

  // 2. Open TODOs without progress
  // 3. Stale dependencies
  // 4. Build errors
  // 5. Test failures

  if (insights.length > 0) {
    insights.forEach(addInsight)
    logForDebugging(`Proactive check found ${insights.length} insight(s)`)
    return true
  }

  return false
}

/**
 * Get proactive state
 */
export function getProactiveState() {
  if (!_proactiveState) _proactiveState = loadProactiveState()
  return {
    active: isProactiveEnabled(),
    tasks: _proactiveState.tasks,
    insights: _proactiveState.insights.filter(i => !i.dismissed),
    pendingCount: _proactiveState.tasks.filter(t => t.status === 'pending').length,
  }
}

/**
 * Get pending insights for display
 */
export function getPendingInsights(limit = 10) {
  if (!_proactiveState) _proactiveState = loadProactiveState()
  return _proactiveState.insights
    .filter(i => !i.dismissed)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit)
}

/**
 * Dismiss an insight
 */
export function dismissInsight(insightId) {
  if (!_proactiveState) _proactiveState = loadProactiveState()
  const insight = _proactiveState.insights.find(i => i.id === insightId)
  if (insight) {
    insight.dismissed = true
    saveProactiveState(_proactiveState)
  }
}

// Default export for commands/proactive.js compatibility
export default {
  name: 'proactive',
  description: 'Toggle proactive mode',
  type: 'local',
  load: async () => {
    return async function proactiveCommand() {
      if (!_proactiveState) setupProactive()
      _proactiveState.enabled = !_proactiveState.enabled
      saveProactiveState(_proactiveState)
      console.log(`Proactive mode ${_proactiveState.enabled ? 'enabled' : 'disabled'}`)
    }
  },
}
