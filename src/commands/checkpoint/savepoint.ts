import type { LocalCommandResult } from '../../commands.js'
import {
  createCheckpointOp,
  listCheckpointsOp,
  rollbackToCheckpointOp,
  deleteCheckpointOp,
} from '../../utils/checkpoints/operations.js'

export async function call(args: string): Promise<LocalCommandResult> {
  const parts = args.trim().split(/\s+/)
  const action = parts[0]?.toLowerCase()
  const name = parts.slice(1).join(' ').trim()

  switch (action) {
    case 'create':
      return handleCreate(name || undefined)
    case 'list':
      return handleList()
    case 'rollback':
      return handleRollback(name)
    case 'delete':
      return handleDelete(name)
    default:
      return {
        type: 'text',
        value: `Usage: /savepoint <create|list|rollback|delete> [name]

Examples:
  /savepoint create before-refactor
  /savepoint list
  /savepoint rollback before-refactor
  /savepoint delete before-refactor`,
      }
  }
}

async function handleCreate(name?: string): Promise<LocalCommandResult> {
  if (!name) {
    return {
      type: 'text',
      value: 'Usage: /savepoint create <name>\n\nProvide a name for the checkpoint.',
    }
  }

  const result = await createCheckpointOp(name)
  if (!result.success) {
    return { type: 'text', value: `Failed: ${result.error}` }
  }

  const cp = result.checkpoint!
  const fileCount = cp.changedFiles.length + cp.untrackedFiles.length
  return {
    type: 'text',
    value: `Checkpoint "${cp.name}" created.\n` +
      `  Branch: ${cp.branch}\n` +
      `  Commit: ${cp.commitHash.slice(0, 8)}\n` +
      `  Files: ${fileCount} tracked, ${cp.untrackedFiles.length} untracked`,
  }
}

async function handleList(): Promise<LocalCommandResult> {
  const checkpoints = await listCheckpointsOp()
  if (checkpoints.length === 0) {
    return { type: 'text', value: 'No checkpoints found.' }
  }

  const lines = checkpoints.map(cp => {
    const status = '_stashExists' in cp ? ((cp as any)._stashExists ? 'OK' : 'MISSING') : 'unknown'
    return `[${status}] ${cp.name} — ${cp.branch} @ ${cp.commitHash.slice(0, 8)} — ${cp.createdAt.slice(0, 19)} — ${cp.changedFiles.length + cp.untrackedFiles.length} files`
  })

  return {
    type: 'text',
    value: `Checkpoints:\n${lines.join('\n')}`,
  }
}

async function handleRollback(name: string): Promise<LocalCommandResult> {
  if (!name) {
    return { type: 'text', value: 'Usage: /savepoint rollback <name>' }
  }

  const result = await rollbackToCheckpointOp(name)
  if (!result.success) {
    return { type: 'text', value: `Rollback failed: ${result.error}` }
  }

  let msg = `Rolled back to "${name}".\nRestored ${result.restoredFiles?.length || 0} file(s).`
  if (result.preRollbackStashRef) {
    msg += `\nCurrent state saved as: ${result.preRollbackStashRef}`
  }
  return { type: 'text', value: msg }
}

async function handleDelete(name: string): Promise<LocalCommandResult> {
  if (!name) {
    return { type: 'text', value: 'Usage: /savepoint delete <name>' }
  }

  const result = await deleteCheckpointOp(name)
  if (!result.success) {
    return { type: 'text', value: `Delete failed: ${result.error}` }
  }

  return { type: 'text', value: `Checkpoint "${name}" deleted.` }
}
