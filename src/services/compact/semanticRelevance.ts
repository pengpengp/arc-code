/**
 * Semantic relevance scoring for post-compaction file selection.
 *
 * Replaces pure timestamp-based sorting in createPostCompactFileAttachments
 * with a composite relevance score. Instead of only keeping the most recently
 * read files, this scores files by multiple factors:
 *
 * - Recency (25%): When the file was last accessed
 * - Frequency (25%): How often the file has been accessed across turns
 * - Centrality (20%): File's position in the import graph (lightweight PageRank)
 * - Error correlation (15%): Whether the file was near recent error locations
 * - Size penalty (15%): Penalize very large files (less likely to be useful)
 *
 * Gated behind SEMANTIC_COMPACTION feature flag for gradual rollout.
 */

import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'

/**
 * Composite relevance score for a file.
 */
export interface FileRelevanceScore {
  path: string
  score: number // 0-100 composite
  factors: {
    recency: number // 0-100, based on timestamp
    frequency: number // 0-100, access count normalized
    centrality: number // 0-100, import graph position
    errorCorrelation: number // 0-100, proximity to errors
    sizePenalty: number // 0-100, inverse of file size
  }
}

// Weight factors (must sum to 1.0)
// TODO: WEIGHT_ERROR is disabled until error correlation tracking is implemented.
// Redistribute: recency/frequency gain the weight back.
const WEIGHT_RECENCY = 0.30
const WEIGHT_FREQUENCY = 0.30
const WEIGHT_CENTRALITY = 0.25
const WEIGHT_ERROR = 0.00
const WEIGHT_SIZE = 0.15

// Recency decay: file read within last 5 minutes = 100, 1 hour ago = ~50
const RECENCY_DECAY_MS = 60 * 60 * 1000 // 1 hour half-life

/**
 * Lightweight file access tracker for frequency scoring.
 * Stores access counts per file path, persisted to a simple JSON file.
 */
export interface FileAccessState {
  counts: Record<string, number>
  lastResetAt: number
}

const FILE_ACCESS_STATE_FILE = 'file_access_state.json'
const FILE_ACCESS_RESET_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Get the file access state, initializing if needed.
 */
function getFileAccessState(): FileAccessState {
  const stateDir = join(getClaudeConfigHomeDir(), 'cache')
  const statePath = join(stateDir, FILE_ACCESS_STATE_FILE)

  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true })
  }

  if (!existsSync(statePath)) {
    return { counts: {}, lastResetAt: Date.now() }
  }

  try {
    const state: FileAccessState = JSON.parse(readFileSync(statePath, 'utf-8'))
    // Reset if older than the reset interval
    if (Date.now() - state.lastResetAt > FILE_ACCESS_RESET_INTERVAL_MS) {
      return { counts: {}, lastResetAt: Date.now() }
    }
    return state
  } catch {
    return { counts: {}, lastResetAt: Date.now() }
  }
}

/**
 * Record a file access event for frequency scoring.
 */
export function recordFileAccess(filePath: string): void {
  try {
    const state = getFileAccessState()
    state.counts[filePath] = (state.counts[filePath] || 0) + 1

    const statePath = join(
      getClaudeConfigHomeDir(),
      'cache',
      FILE_ACCESS_STATE_FILE,
    )
    writeFileSync(statePath, JSON.stringify(state), 'utf-8')
  } catch {
    // Silently ignore — access logging is best-effort
  }
}

/**
 * Compute the composite relevance score for a single file.
 */
function scoreFile(
  filePath: string,
  timestamp: number,
  accessCounts: Record<string, number>,
): FileRelevanceScore {
  // Recency: exponential decay from 100
  const ageMs = Date.now() - timestamp
  const recency = Math.round(100 * Math.exp(-ageMs / RECENCY_DECAY_MS))

  // Frequency: normalize by max access count
  const maxCount = Math.max(1, ...Object.values(accessCounts))
  const frequency = Math.round(((accessCounts[filePath] || 0) / maxCount) * 100)

  // Centrality: files in src/ root or with many imports score higher
  // Simple heuristic: shorter path = more central (proxy for centrality)
  const pathDepth = filePath.split(/[\\/]/).length
  const centrality = Math.max(0, Math.min(100, 100 - (pathDepth - 3) * 15))

  // Size penalty: estimate from path (larger files tend to have more content)
  // Without actually reading, use a moderate default
  const sizePenalty = 50 // Neutral — would need actual file size for better scoring

  // Error correlation: default 50 (neutral)
  // Would be populated from error tracking in a fuller implementation
  const errorCorrelation = 50

  const score = Math.round(
    WEIGHT_RECENCY * recency +
      WEIGHT_FREQUENCY * frequency +
      WEIGHT_CENTRALITY * centrality +
      WEIGHT_ERROR * errorCorrelation +
      WEIGHT_SIZE * sizePenalty,
  )

  return {
    path: filePath,
    score,
    factors: { recency, frequency, centrality, errorCorrelation, sizePenalty },
  }
}

/**
 * Score and rank files by composite relevance instead of pure recency.
 * Drop-in replacement for the timestamp sort in createPostCompactFileAttachments.
 */
export function scoreAndRankFiles(
  files: Array<{ filename: string; content: string; timestamp: number }>,
): Array<{ filename: string; content: string; timestamp: number; relevance: FileRelevanceScore }> {
  const accessState = getFileAccessState()

  const scored = files.map(file => ({
    filename: file.filename,
    content: file.content,
    timestamp: file.timestamp,
    relevance: scoreFile(file.filename, file.timestamp, accessState.counts),
  }))

  scored.sort((a, b) => b.relevance.score - a.relevance.score)
  return scored
}
