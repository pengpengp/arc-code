/**
 * Checkpoint metadata store — file-based persistence following tasks.ts pattern.
 */

import { join } from 'path'
import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { getClaudeConfigHomeDir } from '../envUtils.js'
import { sanitizePathComponent } from '../tasks.js'
import type { CheckpointMetadata } from './types.js'

function defaultDir(): string {
  return join(getClaudeConfigHomeDir(), 'checkpoints')
}

export function getCheckpointsDir(dir?: string): string {
  return dir ?? defaultDir()
}

export function ensureCheckpointsDir(dir?: string): void {
  const d = dir ?? defaultDir()
  if (!existsSync(d)) {
    mkdirSync(d, { recursive: true })
  }
}

export function createCheckpoint(metadata: CheckpointMetadata, dir?: string): void {
  ensureCheckpointsDir(dir)
  const d = dir ?? defaultDir()
  const safeName = sanitizePathComponent(metadata.name)
  const filePath = join(d, `${safeName}_${metadata.id}.json`)
  writeFileSync(filePath, JSON.stringify(metadata, null, 2))
}

export function listCheckpoints(dir?: string): CheckpointMetadata[] {
  ensureCheckpointsDir(dir)
  const d = dir ?? defaultDir()
  const files = readdirSync(d).filter(f => f.endsWith('.json'))
  const checkpoints: CheckpointMetadata[] = []
  for (const file of files) {
    try {
      const data = readFileSync(join(d, file), 'utf-8')
      checkpoints.push(JSON.parse(data) as CheckpointMetadata)
    } catch {
      // Skip corrupted files
    }
  }
  return checkpoints.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function loadCheckpoint(name: string, dir?: string): CheckpointMetadata | null {
  const safeName = sanitizePathComponent(name)
  ensureCheckpointsDir(dir)
  const d = dir ?? defaultDir()
  const files = readdirSync(d).filter(f => f.endsWith('.json') && f.startsWith(safeName))
  if (files.length === 0) return null
  // Return the most recent one
  let latest: CheckpointMetadata | null = null
  let latestDate = ''
  for (const file of files) {
    try {
      const data = readFileSync(join(d, file), 'utf-8')
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

export function deleteCheckpoint(id: string, dir?: string): boolean {
  ensureCheckpointsDir(dir)
  const d = dir ?? defaultDir()
  const files = readdirSync(d).filter(f => f.endsWith('.json') && f.includes(id))
  let deleted = false
  for (const file of files) {
    try {
      unlinkSync(join(d, file))
      deleted = true
    } catch {
      // Skip files that can't be deleted
    }
  }
  return deleted
}
