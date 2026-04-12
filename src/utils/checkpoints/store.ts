/**
 * Checkpoint metadata store — file-based persistence following tasks.ts pattern.
 */

import { join } from 'path'
import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { getClaudeConfigHomeDir } from '../envUtils.js'
import { sanitizePathComponent } from '../tasks.js'
import type { CheckpointMetadata } from './types.js'

const CHECKPOINTS_DIR = join(getClaudeConfigHomeDir(), 'checkpoints')

export function getCheckpointsDir(): string {
  return CHECKPOINTS_DIR
}

export function ensureCheckpointsDir(): void {
  if (!existsSync(CHECKPOINTS_DIR)) {
    mkdirSync(CHECKPOINTS_DIR, { recursive: true })
  }
}

export function createCheckpoint(metadata: CheckpointMetadata): void {
  ensureCheckpointsDir()
  const safeName = sanitizePathComponent(metadata.name)
  const filePath = join(CHECKPOINTS_DIR, `${safeName}_${metadata.id}.json`)
  writeFileSync(filePath, JSON.stringify(metadata, null, 2))
}

export function listCheckpoints(): CheckpointMetadata[] {
  ensureCheckpointsDir()
  const files = readdirSync(CHECKPOINTS_DIR).filter(f => f.endsWith('.json'))
  const checkpoints: CheckpointMetadata[] = []
  for (const file of files) {
    try {
      const data = readFileSync(join(CHECKPOINTS_DIR, file), 'utf-8')
      checkpoints.push(JSON.parse(data) as CheckpointMetadata)
    } catch {
      // Skip corrupted files
    }
  }
  return checkpoints.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function loadCheckpoint(name: string): CheckpointMetadata | null {
  const safeName = sanitizePathComponent(name)
  ensureCheckpointsDir()
  const files = readdirSync(CHECKPOINTS_DIR).filter(f => f.endsWith('.json') && f.startsWith(safeName))
  if (files.length === 0) return null
  // Return the most recent one
  let latest: CheckpointMetadata | null = null
  let latestDate = ''
  for (const file of files) {
    try {
      const data = readFileSync(join(CHECKPOINTS_DIR, file), 'utf-8')
      const cp = JSON.parse(data) as CheckpointMetadata
      if (cp.createdAt > latestDate) {
        latest = cp
        latestDate = cp.createdAt
      }
    } catch {
      // Skip corrupted files
    }
  }
  return latest
}

export function deleteCheckpoint(id: string): boolean {
  ensureCheckpointsDir()
  const files = readdirSync(CHECKPOINTS_DIR).filter(f => f.endsWith('.json') && f.includes(id))
  let deleted = false
  for (const file of files) {
    try {
      unlinkSync(join(CHECKPOINTS_DIR, file))
      deleted = true
    } catch {
      // Skip files that can't be deleted
    }
  }
  return deleted
}
