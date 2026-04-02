/**
 * Commit Attribution Hooks - Track which files were modified by Claude.
 * Registers git hooks that attribute changes to Claude Code sessions.
 */
import { execSync } from 'child_process'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { getClaudeConfigHomeDir } from './envUtils.js'
import { logForDebugging } from './debug.js'

const ATTRIBUTION_DIR = join(getClaudeConfigHomeDir(), 'attribution')
const FILE_CONTENT_CACHE = new Map()
const PENDING_BASH_STATES = new Map()

/**
 * Register attribution hooks on git events
 */
export function registerAttributionHooks() {
  try {
    // Check if we're in a git repo
    execSync('git rev-parse --git-dir', { stdio: 'pipe' })

    // Ensure attribution directory exists
    if (!existsSync(ATTRIBUTION_DIR)) {
      mkdirSync(ATTRIBUTION_DIR, { recursive: true })
    }

    // Register pre-commit hook to track modified files
    const gitDir = execSync('git rev-parse --git-dir', { encoding: 'utf-8' }).trim()
    const hooksDir = join(gitDir, 'hooks')

    if (existsSync(hooksDir)) {
      // Create pre-commit hook
      const preCommitPath = join(hooksDir, 'pre-commit')
      if (!existsSync(preCommitPath)) {
        writeFileSync(preCommitPath, `#!/bin/sh
# Claude Code attribution hook
# Tracks which files were modified during Claude sessions
CLAUDE_DIR="$HOME/.claude/attribution"
mkdir -p "$CLAUDE_DIR"
git diff --cached --name-only >> "$CLAUDE_DIR/last-session-files.txt"
`, { mode: 0o755 })
      }
    }

    logForDebugging('Attribution hooks registered')
  } catch {
    // Not in a git repo or git not available
  }
}

/**
 * Clear attribution caches
 */
export function clearAttributionCaches() {
  FILE_CONTENT_CACHE.clear()
  PENDING_BASH_STATES.clear()
}

/**
 * Sweep file content cache - remove stale entries
 */
export function sweepFileContentCache() {
  // Remove entries older than 1 hour
  const now = Date.now()
  for (const [key, value] of FILE_CONTENT_CACHE.entries()) {
    if (now - value.timestamp > 3600000) {
      FILE_CONTENT_CACHE.delete(key)
    }
  }
}

/**
 * Track a file modification for attribution
 */
export function trackFileModification(filePath, sessionId) {
  try {
    const attributionFile = join(ATTRIBUTION_DIR, `${sessionId}.json`)
    let attribution = { files: [], sessionId, timestamp: Date.now() }

    if (existsSync(attributionFile)) {
      attribution = JSON.parse(readFileSync(attributionFile, 'utf-8'))
    }

    if (!attribution.files.includes(filePath)) {
      attribution.files.push(filePath)
      writeFileSync(attributionFile, JSON.stringify(attribution, null, 2))
    }
  } catch (err) {
    logForDebugging(`Failed to track file modification: ${err.message}`)
  }
}

/**
 * Get attribution for current session
 */
export function getSessionAttribution(sessionId) {
  try {
    const attributionFile = join(ATTRIBUTION_DIR, `${sessionId}.json`)
    if (existsSync(attributionFile)) {
      return JSON.parse(readFileSync(attributionFile, 'utf-8'))
    }
  } catch {
    // Return empty attribution
  }
  return { files: [], sessionId, timestamp: Date.now() }
}
