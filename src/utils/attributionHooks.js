/**
 * Commit attribution hooks — tracks file access/content during sessions
 * for determining which files contributed to which commits.
 * Used by COMMIT_ATTRIBUTION feature flag.
 */

const attributionCache = new Map<string, { accesses: number; lastAccess: number }>()
let fileContentCache = new Map<string, { content: string; timestamp: number }>()

export function registerAttributionHooks(): void {
  // Hooks are registered at startup via setup.ts
  // In this stub, attribution tracking is a no-op passthrough
}

export function clearAttributionCaches(): void {
  attributionCache.clear()
  fileContentCache.clear()
}

export function sweepFileContentCache(): void {
  // Called after compaction to clean up stale file content entries
  const cutoff = Date.now() - 30 * 60 * 1000 // 30 minutes
  for (const [key, entry] of fileContentCache) {
    if (entry.timestamp < cutoff) {
      fileContentCache.delete(key)
    }
  }
}

/**
 * Record a file access for attribution tracking.
 */
export function recordFileAccess(filePath: string, _content?: string): void {
  const existing = attributionCache.get(filePath) ?? { accesses: 0, lastAccess: 0 }
  attributionCache.set(filePath, {
    accesses: existing.accesses + 1,
    lastAccess: Date.now(),
  })
  if (_content) {
    fileContentCache.set(filePath, { content: _content, timestamp: Date.now() })
  }
}

/**
 * Get attribution data for the current session.
 */
export function getAttributionData(): Map<string, { accesses: number; lastAccess: number }> {
  return new Map(attributionCache)
}
