/**
 * Memory shape telemetry — logs memory access patterns for memdir analytics.
 * Used by MEMORY_SHAPE_TELEMETRY feature flag.
 */

import { logEvent } from '../services/analytics/index.js'

/**
 * Log a memory write operation for analytics.
 * Tracks which files are being written and their sizes.
 */
export function logMemoryWriteShape(filePaths: string[], sizes: number[]): void {
  logEvent('memory_write_shape', {
    fileCount: filePaths.length,
    totalSize: sizes.reduce((a, b) => a + b, 0),
    avgSize: sizes.length > 0 ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length) : 0,
  })
}

/**
 * Log a memory recall operation for analytics.
 * Tracks how many memories were selected and their relevance scores.
 */
export function logMemoryRecallShape(
  totalMemories: number,
  selectedCount: number,
  avgRelevance?: number,
): void {
  logEvent('memory_recall_shape', {
    totalMemories,
    selectedCount,
    ...(avgRelevance !== undefined && { avgRelevance: Math.round(avgRelevance * 100) / 100 }),
  })
}
