/**
 * Tests for checkpoint store — file-based persistence with temp directory isolation.
 */

import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdtempSync, rmSync } from 'fs'
import { createCheckpoint, listCheckpoints, loadCheckpoint, deleteCheckpoint, ensureCheckpointsDir } from '../store.js'

describe('checkpoint store', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'checkpoint-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('createCheckpoint', () => {
    it('writes a checkpoint JSON file', () => {
      const metadata = {
        id: 'test-123',
        name: 'test-point',
        createdAt: '2026-04-12T10:00:00.000Z',
        branch: 'main',
        commitHash: 'abc123',
        changedFiles: ['src/index.ts'],
        stashRef: 'refs/stash@{0}',
        stashHash: 'def456',
        untrackedFiles: [],
      }

      createCheckpoint(metadata, tempDir)

      const checkpoints = listCheckpoints(tempDir)
      expect(checkpoints).toHaveLength(1)
      expect(checkpoints[0].id).toBe('test-123')
      expect(checkpoints[0].name).toBe('test-point')
    })

    it('creates the directory if it does not exist', () => {
      const nestedDir = join(tempDir, 'nested', 'checkpoints')
      const metadata = {
        id: 'auto-dir',
        name: 'auto-dir-test',
        createdAt: '2026-04-12T10:00:00.000Z',
        branch: 'main',
        commitHash: 'abc',
        changedFiles: [],
        stashRef: 'refs/stash@{0}',
        stashHash: 'hash',
        untrackedFiles: [],
      }

      expect(() => createCheckpoint(metadata, nestedDir)).not.toThrow()
      expect(listCheckpoints(nestedDir)).toHaveLength(1)
    })

    it('sanitizes checkpoint names for safe filenames', () => {
      const metadata = {
        id: 'sanitize-test',
        name: 'before/refactor',
        createdAt: '2026-04-12T10:00:00.000Z',
        branch: 'main',
        commitHash: 'abc',
        changedFiles: [],
        stashRef: 'refs/stash@{0}',
        stashHash: 'hash',
        untrackedFiles: [],
      }

      // Should not throw even with path separator in name
      expect(() => createCheckpoint(metadata, tempDir)).not.toThrow()
    })
  })

  describe('listCheckpoints', () => {
    it('returns empty array when no checkpoints exist', () => {
      const result = listCheckpoints(tempDir)
      expect(result).toEqual([])
    })

    it('returns checkpoints sorted by createdAt descending', () => {
      const cp1 = {
        id: 'cp1',
        name: 'first',
        createdAt: '2026-04-12T08:00:00.000Z',
        branch: 'main',
        commitHash: 'a',
        changedFiles: [],
        stashRef: 'refs/stash@{0}',
        stashHash: 'h1',
        untrackedFiles: [],
      }

      const cp2 = {
        id: 'cp2',
        name: 'second',
        createdAt: '2026-04-12T10:00:00.000Z',
        branch: 'main',
        commitHash: 'b',
        changedFiles: [],
        stashRef: 'refs/stash@{0}',
        stashHash: 'h2',
        untrackedFiles: [],
      }

      const cp3 = {
        id: 'cp3',
        name: 'third',
        createdAt: '2026-04-12T09:00:00.000Z',
        branch: 'main',
        commitHash: 'c',
        changedFiles: [],
        stashRef: 'refs/stash@{0}',
        stashHash: 'h3',
        untrackedFiles: [],
      }

      createCheckpoint(cp1, tempDir)
      createCheckpoint(cp2, tempDir)
      createCheckpoint(cp3, tempDir)

      const result = listCheckpoints(tempDir)
      expect(result).toHaveLength(3)
      expect(result[0].name).toBe('second')
      expect(result[1].name).toBe('third')
      expect(result[2].name).toBe('first')
    })

    it('skips corrupted JSON files', () => {
      // Write an invalid JSON file
      const { writeFileSync } = require('fs')
      writeFileSync(join(tempDir, 'bad_123.json'), 'not valid json')

      const cp = {
        id: 'good-cp',
        name: 'good',
        createdAt: '2026-04-12T10:00:00.000Z',
        branch: 'main',
        commitHash: 'abc',
        changedFiles: [],
        stashRef: 'refs/stash@{0}',
        stashHash: 'hash',
        untrackedFiles: [],
      }

      createCheckpoint(cp, tempDir)

      // Should not throw, should return only valid checkpoint
      const result = listCheckpoints(tempDir)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('good')
    })
  })

  describe('loadCheckpoint', () => {
    it('returns null when checkpoint does not exist', () => {
      const result = loadCheckpoint('nonexistent', tempDir)
      expect(result).toBeNull()
    })

    it('loads a checkpoint by name', () => {
      const cp = {
        id: 'load-test',
        name: 'my-checkpoint',
        createdAt: '2026-04-12T10:00:00.000Z',
        branch: 'main',
        commitHash: 'abc123',
        changedFiles: ['src/index.ts'],
        stashRef: 'refs/stash@{0}',
        stashHash: 'def456',
        untrackedFiles: ['new-file.ts'],
      }

      createCheckpoint(cp, tempDir)

      const result = loadCheckpoint('my-checkpoint', tempDir)
      expect(result).not.toBeNull()
      expect(result?.id).toBe('load-test')
      expect(result?.changedFiles).toContain('src/index.ts')
      expect(result?.untrackedFiles).toContain('new-file.ts')
    })

    it('returns the most recent checkpoint when multiple match', () => {
      const cp1 = {
        id: 'old',
        name: 'shared-name',
        createdAt: '2026-04-12T08:00:00.000Z',
        branch: 'main',
        commitHash: 'old-hash',
        changedFiles: [],
        stashRef: 'refs/stash@{0}',
        stashHash: 'old-stash',
        untrackedFiles: [],
      }

      const cp2 = {
        id: 'new',
        name: 'shared-name',
        createdAt: '2026-04-12T12:00:00.000Z',
        branch: 'main',
        commitHash: 'new-hash',
        changedFiles: ['file.ts'],
        stashRef: 'refs/stash@{1}',
        stashHash: 'new-stash',
        untrackedFiles: [],
      }

      createCheckpoint(cp1, tempDir)
      createCheckpoint(cp2, tempDir)

      const result = loadCheckpoint('shared-name', tempDir)
      expect(result).not.toBeNull()
      expect(result?.id).toBe('new')
      expect(result?.commitHash).toBe('new-hash')
    })
  })

  describe('deleteCheckpoint', () => {
    it('returns false when checkpoint does not exist', () => {
      const result = deleteCheckpoint('nonexistent', tempDir)
      expect(result).toBe(false)
    })

    it('deletes a checkpoint file', () => {
      const cp = {
        id: 'to-delete',
        name: 'delete-me',
        createdAt: '2026-04-12T10:00:00.000Z',
        branch: 'main',
        commitHash: 'abc',
        changedFiles: [],
        stashRef: 'refs/stash@{0}',
        stashHash: 'hash',
        untrackedFiles: [],
      }

      createCheckpoint(cp, tempDir)
      expect(listCheckpoints(tempDir)).toHaveLength(1)

      const result = deleteCheckpoint('to-delete', tempDir)
      expect(result).toBe(true)
      expect(listCheckpoints(tempDir)).toHaveLength(0)
    })

    it('deletes all files matching the ID', () => {
      // Create two checkpoints with overlapping IDs
      const cp1 = {
        id: 'same-id',
        name: 'first-occurrence',
        createdAt: '2026-04-12T08:00:00.000Z',
        branch: 'main',
        commitHash: 'a',
        changedFiles: [],
        stashRef: 'refs/stash@{0}',
        stashHash: 'h1',
        untrackedFiles: [],
      }

      const cp2 = {
        id: 'same-id',
        name: 'second-occurrence',
        createdAt: '2026-04-12T10:00:00.000Z',
        branch: 'main',
        commitHash: 'b',
        changedFiles: [],
        stashRef: 'refs/stash@{1}',
        stashHash: 'h2',
        untrackedFiles: [],
      }

      createCheckpoint(cp1, tempDir)
      createCheckpoint(cp2, tempDir)
      expect(listCheckpoints(tempDir)).toHaveLength(2)

      const result = deleteCheckpoint('same-id', tempDir)
      expect(result).toBe(true)
      expect(listCheckpoints(tempDir)).toHaveLength(0)
    })
  })
})
