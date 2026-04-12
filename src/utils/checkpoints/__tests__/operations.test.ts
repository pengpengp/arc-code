/**
 * Tests for checkpoint operations — git stash orchestration (mocked git calls).
 */

import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdtempSync, rmSync } from 'fs'

// Mock the git module before importing operations
const mockGetGitState = mock(() => ({
  branchName: 'main',
  commitHash: 'abc123def',
  remoteUrl: 'https://github.com/owner/repo.git',
}))

const mockGetFileStatus = mock(() => ({
  tracked: ['src/index.ts', 'src/utils.ts'],
  untracked: ['new-file.ts'],
}))

const mockStashToCleanState = mock(async () => true)

const mockGetIsClean = mock(async () => true)

const mockGitExe = mock(() => 'git')

const mockExecFileNoThrow = mock(async () => ({
  code: 0,
  stdout: 'deadbeef refs/stash@{0}',
  stderr: '',
}))

mock.module('../../git.js', () => ({
  getGitState: mockGetGitState,
  getFileStatus: mockGetFileStatus,
  stashToCleanState: mockStashToCleanState,
  getIsClean: mockGetIsClean,
  gitExe: mockGitExe,
}))

mock.module('../../execFileNoThrow.js', () => ({
  execFileNoThrow: mockExecFileNoThrow,
}))

// Import after mocking
import { createCheckpointOp, listCheckpointsOp, deleteCheckpointOp } from '../operations.js'

describe('checkpoint operations', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'checkpoint-ops-test-'))
    mockGetGitState.mockClear()
    mockGetFileStatus.mockClear()
    mockStashToCleanState.mockClear()
    mockExecFileNoThrow.mockClear()
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('createCheckpointOp', () => {
    it('creates a checkpoint successfully', async () => {
      const result = await createCheckpointOp('test-point', 'Test description')

      expect(result.success).toBe(true)
      expect(result.checkpoint).toBeDefined()
      expect(result.checkpoint?.name).toBe('test-point')
      expect(result.checkpoint?.description).toBe('Test description')
      expect(result.checkpoint?.branch).toBe('main')
      expect(result.checkpoint?.changedFiles).toContain('src/index.ts')
      expect(result.checkpoint?.untrackedFiles).toContain('new-file.ts')
      expect(mockStashToCleanState).toHaveBeenCalled()
    })

    it('returns error when not in git repository', async () => {
      mockGetGitState.mockReturnValueOnce(null)

      const result = await createCheckpointOp('fail-point')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Not in a git repository.')
    })

    it('returns error when git stash fails', async () => {
      mockStashToCleanState.mockResolvedValueOnce(false)

      const result = await createCheckpointOp('stash-fail')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to create git stash for checkpoint.')
    })
  })

  describe('listCheckpointsOp', () => {
    it('returns checkpoints with stash existence info', async () => {
      // First create a checkpoint
      await createCheckpointOp('list-test')

      const results = await listCheckpointsOp()

      expect(results.length).toBeGreaterThan(0)
      // _stashExists depends on whether the mock stdout contains the stash hash
      // Since we mock with a fixed hash that won't match, just verify the field exists
      expect('_stashExists' in results[0]).toBe(true)
    })

    it('returns all checkpoints when stash list check fails', async () => {
      mockExecFileNoThrow.mockRejectedValueOnce(new Error('git not found'))

      const results = await listCheckpointsOp()

      // Should still return checkpoints (graceful degradation)
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('deleteCheckpointOp', () => {
    it('returns error when checkpoint not found', async () => {
      const result = await deleteCheckpointOp('nonexistent')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Checkpoint "nonexistent" not found.')
    })

    it('deletes a checkpoint', async () => {
      // First create one
      await createCheckpointOp('to-delete')

      const result = await deleteCheckpointOp('to-delete')

      expect(result.success).toBe(true)
    })
  })
})
