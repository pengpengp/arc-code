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

import { join, dirname, extname } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { getInMemoryErrors } from '../../utils/log.js'

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
const WEIGHT_RECENCY = 0.25
const WEIGHT_FREQUENCY = 0.25
const WEIGHT_CENTRALITY = 0.20
const WEIGHT_ERROR = 0.15
const WEIGHT_SIZE = 0.15

// Recency decay: file read within last 5 minutes = 100, 1 hour ago = ~50
const RECENCY_DECAY_MS = 60 * 60 * 1000 // 1 hour half-life

// Error correlation: look back 30 minutes for errors
const ERROR_WINDOW_MS = 30 * 60 * 1000

// Import graph: file extensions to scan for import/export statements
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
])

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

// --- Module-level memoization cache ---
let cachedFileAccessState: FileAccessState | null = null
let cachedFileAccessTimestamp = 0
const FILE_ACCESS_CACHE_TTL_MS = 60_000 // 60 seconds

/**
 * Get the file access state, initialized and memoized.
 * Cache is invalidated after FILE_ACCESS_CACHE_TTL_MS.
 */
function getFileAccessState(): FileAccessState {
  const now = Date.now()
  if (cachedFileAccessState && (now - cachedFileAccessTimestamp) < FILE_ACCESS_CACHE_TTL_MS) {
    return cachedFileAccessState
  }

  const stateDir = join(getClaudeConfigHomeDir(), 'cache')
  const statePath = join(stateDir, FILE_ACCESS_STATE_FILE)

  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true })
  }

  let result: FileAccessState
  if (!existsSync(statePath)) {
    result = { counts: {}, lastResetAt: now }
  } else {
    try {
      const state: FileAccessState = JSON.parse(readFileSync(statePath, 'utf-8'))
      // Reset if older than the reset interval
      if (now - state.lastResetAt > FILE_ACCESS_RESET_INTERVAL_MS) {
        result = { counts: {}, lastResetAt: now }
      } else {
        result = state
      }
    } catch {
      result = { counts: {}, lastResetAt: now }
    }
  }

  cachedFileAccessState = result
  cachedFileAccessTimestamp = now
  return result
}

/**
 * Invalidate the memoized file access state (e.g., after writing a new value).
 */
function invalidateFileAccessCache(): void {
  cachedFileAccessState = null
  cachedFileAccessTimestamp = 0
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
    invalidateFileAccessCache()
  } catch {
    // Silently ignore — access logging is best-effort
  }
}

/**
 * Batch stat all files once and return a size map. Avoids N statSync calls
 * inside the per-file score loop.
 */
function batchStatFiles(filePaths: Set<string>): Map<string, number> {
  const sizes = new Map<string, number>()
  for (const fp of filePaths) {
    try {
      const st = statSync(fp)
      sizes.set(fp, st.size)
    } catch {
      sizes.set(fp, -1) // sentinel: unknown
    }
  }
  return sizes
}

/**
 * Compute the composite relevance score for a single file.
 */
function scoreFile(
  filePath: string,
  timestamp: number,
  accessCounts: Record<string, number>,
  sizeKB: number | undefined,
  importCounts?: Record<string, number>,
  errorFiles?: Set<string>,
): FileRelevanceScore {
  // Recency: exponential decay from 100
  const ageMs = Date.now() - timestamp
  const recency = Math.round(100 * Math.exp(-ageMs / RECENCY_DECAY_MS))

  // Frequency: normalize by max access count
  const maxCount = Math.max(1, ...Object.values(accessCounts))
  const frequency = Math.round(((accessCounts[filePath] || 0) / maxCount) * 100)

  // Centrality: use import graph count if available, fallback to path depth
  let centrality: number
  if (importCounts && importCounts[filePath] != null) {
    // Files imported by others are more central — normalize by max importers
    const maxImporters = Math.max(1, ...Object.values(importCounts))
    centrality = Math.round(((importCounts[filePath] ?? 0) / maxImporters) * 100)
  } else {
    // Fallback: shorter path = more central (proxy)
    const pathDepth = filePath.split(/[\\/]/).length
    centrality = Math.max(0, Math.min(100, 100 - (pathDepth - 3) * 15))
  }

  // Error correlation: check if this file appears in recent error logs
  let errorCorrelation: number
  if (errorFiles && errorFiles.has(filePath)) {
    errorCorrelation = 100
  } else {
    // Check if file is in the same directory as a recent error
    const fileDir = dirname(filePath)
    let nearby = false
    for (const ef of errorFiles ?? []) {
      if (dirname(ef) === fileDir) {
        nearby = true
        break
      }
    }
    errorCorrelation = nearby ? 75 : 50
  }

  // Size penalty: use pre-fetched size
  let sizePenalty: number
  if (sizeKB === undefined) {
    sizePenalty = 50 // Unknown size, neutral
  } else if (sizeKB > 500) {
    sizePenalty = 10
  } else if (sizeKB > 200) {
    sizePenalty = 25
  } else if (sizeKB > 100) {
    sizePenalty = 40
  } else if (sizeKB > 50) {
    sizePenalty = 60
  } else {
    sizePenalty = 80
  }

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
 * Extract recent error files from in-memory error log.
 * Parses error messages for file paths referenced in stack traces.
 */
function getRecentErrorFiles(): Set<string> {
  const errors = getInMemoryErrors()
  const errorFiles = new Set<string>()
  const cutoff = Date.now() - ERROR_WINDOW_MS

  for (const entry of errors) {
    const ts = new Date(entry.timestamp).getTime()
    if (ts < cutoff) continue

    // Extract file paths from stack traces (common patterns)
    const matches = entry.error.match(/(?:at|in)\s+.*\(([^)]+):\d+:\d+\)/g)
    if (matches) {
      for (const m of matches) {
        const pathMatch = m.match(/\(([^)]+):\d+:\d+\)/)
        if (pathMatch) {
          errorFiles.add(pathMatch[1])
        }
      }
    }

    // Also match direct file:line references
    const directMatches = entry.error.match(/(?:^|\s)(\S+\.\w+):\d+/g)
    if (directMatches) {
      for (const m of directMatches) {
        const path = m.trim()
        if (existsSync(path)) {
          errorFiles.add(path)
        }
      }
    }
  }

  return errorFiles
}

/**
 * Build a lightweight import count map by scanning code files for import statements.
 * Returns a map of imported file path → count of files that import it.
 */
function buildImportCounts(
  fileSet: Set<string>,
): Record<string, number> {
  const importCounts: Record<string, number> = {}

  for (const filePath of fileSet) {
    const ext = extname(filePath).toLowerCase()
    if (!CODE_EXTENSIONS.has(ext)) continue

    try {
      const content = readFileSync(filePath, 'utf-8')
      // Match ES module imports: import ... from '...'
      const esImports = content.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g)
      // Match CommonJS imports: require('...')
      const cjsImports = content.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g)

      for (const match of [...esImports, ...cjsImports]) {
        const importedPath = match[1]
        if (importedPath) {
          importCounts[importedPath] = (importCounts[importedPath] || 0) + 1
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return importCounts
}

/**
 * Score and rank files by composite relevance instead of pure recency.
 * Drop-in replacement for the timestamp sort in createPostCompactFileAttachments.
 */
export function scoreAndRankFiles(
  files: Array<{ filename: string; content: string; timestamp: number }>,
): Array<{ filename: string; content: string; timestamp: number; relevance: FileRelevanceScore }> {
  const accessState = getFileAccessState()
  const errorFiles = getRecentErrorFiles()

  // Build import graph from the candidate files and their project neighbors
  const allFilePaths = new Set(files.map(f => f.filename))
  const importCounts = buildImportCounts(allFilePaths)

  // Batch stat all files once instead of per-file in scoreFile
  const sizeMap = batchStatFiles(allFilePaths)

  const scored = files.map(file => ({
    filename: file.filename,
    content: file.content,
    timestamp: file.timestamp,
    relevance: scoreFile(
      file.filename,
      file.timestamp,
      accessState.counts,
      sizeMap.has(file.filename) ? sizeMap.get(file.filename)! / 1024 : undefined,
      importCounts,
      errorFiles,
    ),
  }))

  scored.sort((a, b) => b.relevance.score - a.relevance.score)
  return scored
}
