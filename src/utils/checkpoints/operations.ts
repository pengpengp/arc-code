/**
 * Checkpoint git operations — wraps git.ts primitives for checkpoint/rollback.
 */

import { randomUUID } from 'crypto'
import { getGitState, getFileStatus, gitExe, stashToCleanState, getIsClean } from '../git.js'
import { execFileNoThrow } from '../execFileNoThrow.js'
import { createCheckpoint, loadCheckpoint, deleteCheckpoint as deleteCheckpointMeta, listCheckpoints as listCheckpointsStore } from './store.js'
import type { CheckpointMetadata } from './types.js'

/**
 * Create a named checkpoint of the current working tree state.
 */
export async function createCheckpointOp(name: string, description?: string): Promise<{ success: boolean; error?: string; checkpoint?: CheckpointMetadata }> {
  const gitState = await getGitState()
  if (!gitState) {
    return { success: false, error: 'Not in a git repository.' }
  }

  const fileStatus = await getFileStatus()
  const allChangedFiles = fileStatus.tracked

  const stashMessage = `checkpoint: ${name} - ${new Date().toISOString()}`
  const stashOk = await stashToCleanState(stashMessage)
  if (!stashOk) {
    return { success: false, error: 'Failed to create git stash for checkpoint.' }
  }

  // Resolve the stash ref and hash
  const { stdout: stashList } = await execFileNoThrow(
    gitExe(),
    ['stash', 'list', '--format=%H %gd', '-1'],
    { preserveOutputOnError: false },
  )
  const parts = stashList.trim().split(' ')
  const stashHash = parts[0] || ''
  const stashRef = parts[1] || 'refs/stash@{0}'

  const metadata: CheckpointMetadata = {
    id: randomUUID().slice(0, 8),
    name,
    description,
    createdAt: new Date().toISOString(),
    branch: gitState.branchName,
    commitHash: gitState.commitHash,
    changedFiles: allChangedFiles,
    stashRef,
    stashHash,
    untrackedFiles: fileStatus.untracked,
  }

  createCheckpoint(metadata)

  return { success: true, checkpoint: metadata }
}

/**
 * List all checkpoints with stash existence validation.
 */
export async function listCheckpointsOp(): Promise<CheckpointMetadata[]> {
  const checkpoints = listCheckpointsStore()

  // Cross-reference with git stash list
  try {
    const { stdout: stashList } = await execFileNoThrow(
      gitExe(),
      ['stash', 'list', '--format=%H'],
      { preserveOutputOnError: false },
    )
    const stashHashes = new Set(stashList.trim().split('\n').filter(Boolean))

    return checkpoints.map(cp => ({
      ...cp,
      _stashExists: stashHashes.has(cp.stashHash),
    }))
  } catch {
    return checkpoints
  }
}

/**
 * Rollback to a named checkpoint.
 * Safety: if working tree is dirty, creates a safety stash first.
 */
export async function rollbackToCheckpointOp(name: string): Promise<{ success: boolean; error?: string; preRollbackStashRef?: string; restoredFiles?: string[] }> {
  const cp = loadCheckpoint(name)
  if (!cp) {
    return { success: false, error: `Checkpoint "${name}" not found.` }
  }

  const gitState = await getGitState()
  if (!gitState) {
    return { success: false, error: 'Not in a git repository.' }
  }

  let preRollbackStashRef: string | undefined

  // Safety: stash current dirty state if tree is not clean
  const isClean = await getIsClean()
  if (!isClean) {
    const safetyMessage = `pre-rollback-${name}-${new Date().toISOString()}`
    const stashOk = await stashToCleanState(safetyMessage)
    if (!stashOk) {
      return { success: false, error: 'Failed to save current state before rollback.' }
    }

    // Get the new stash ref
    try {
      const { stdout: stashList } = await execFileNoThrow(
        gitExe(),
        ['stash', 'list', '--format=%gd', '-1'],
        { preserveOutputOnError: false },
      )
      preRollbackStashRef = stashList.trim()
    } catch {
      // Best effort
    }
  }

  // Apply the checkpoint stash
  const { code, stderr } = await execFileNoThrow(
    gitExe(),
    ['stash', 'apply', '--index', cp.stashHash],
    { preserveOutputOnError: false },
  )

  if (code !== 0) {
    return {
      success: false,
      error: `Failed to apply checkpoint stash: ${stderr}`,
      preRollbackStashRef,
    }
  }

  return {
    success: true,
    preRollbackStashRef,
    restoredFiles: cp.changedFiles,
  }
}

/**
 * Delete a checkpoint (drop stash + remove metadata).
 */
export async function deleteCheckpointOp(name: string): Promise<{ success: boolean; error?: string }> {
  const cp = loadCheckpoint(name)
  if (!cp) {
    return { success: false, error: `Checkpoint "${name}" not found.` }
  }

  // Drop the git stash
  await execFileNoThrow(
    gitExe(),
    ['stash', 'drop', cp.stashHash],
    { preserveOutputOnError: false },
  )

  // Delete metadata
  deleteCheckpointMeta(cp.id)

  return { success: true }
}
