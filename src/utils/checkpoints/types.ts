/**
 * Checkpoint types for the git-based checkpoint/rollback system.
 */

export interface CheckpointMetadata {
  id: string
  name: string
  description?: string
  createdAt: string
  branch: string
  commitHash: string
  changedFiles: string[]
  stashRef: string
  stashHash: string
  untrackedFiles: string[]
}
