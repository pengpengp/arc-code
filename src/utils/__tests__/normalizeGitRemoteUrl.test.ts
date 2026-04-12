/**
 * Tests for normalizeGitRemoteUrl — pure URL normalization function.
 */

import { describe, expect, it } from 'bun:test'
import { normalizeGitRemoteUrl } from '../normalizeGitRemoteUrl.js'

describe('normalizeGitRemoteUrl', () => {
  describe('HTTPS URLs', () => {
    it('normalizes standard GitHub HTTPS URL', () => {
      expect(normalizeGitRemoteUrl('https://github.com/owner/repo.git')).toBe('github.com/owner/repo')
    })

    it('normalizes HTTPS URL without .git suffix', () => {
      expect(normalizeGitRemoteUrl('https://github.com/owner/repo')).toBe('github.com/owner/repo')
    })

    it('normalizes GitLab HTTPS URL', () => {
      expect(normalizeGitRemoteUrl('https://gitlab.com/group/project.git')).toBe('gitlab.com/group/project')
    })
  })

  describe('SSH URLs', () => {
    it('normalizes SSH URL format', () => {
      expect(normalizeGitRemoteUrl('ssh://git@github.com/owner/repo')).toBe('github.com/owner/repo')
    })

    it('normalizes git@host:owner/repo.git format', () => {
      expect(normalizeGitRemoteUrl('git@github.com:owner/repo.git')).toBe('github.com/owner/repo')
    })

    it('normalizes git@host:owner/repo without .git', () => {
      expect(normalizeGitRemoteUrl('git@github.com:owner/repo')).toBe('github.com/owner/repo')
    })

    it('normalizes SSH URL with nested path', () => {
      expect(normalizeGitRemoteUrl('ssh://git@gitlab.com/group/subgroup/project.git')).toBe('gitlab.com/group/subgroup/project')
    })
  })

  describe('CCR proxy URLs', () => {
    it('normalizes legacy proxy URL (assumes github.com)', () => {
      expect(normalizeGitRemoteUrl('http://local@127.0.0.1:16583/git/owner/repo')).toBe('github.com/owner/repo')
    })

    it('normalizes GHE format proxy URL (host in path)', () => {
      expect(normalizeGitRemoteUrl('http://local@127.0.0.1:16583/git/ghe.company.com/owner/repo')).toBe('ghe.company.com/owner/repo')
    })
  })

  describe('Edge cases', () => {
    it('returns null for empty string', () => {
      expect(normalizeGitRemoteUrl('')).toBeNull()
    })

    it('returns null for whitespace-only string', () => {
      expect(normalizeGitRemoteUrl('   ')).toBeNull()
    })

    it('trims whitespace from URL', () => {
      expect(normalizeGitRemoteUrl('  https://github.com/owner/repo.git  ')).toBe('github.com/owner/repo')
    })

    it('returns null for unrecognized URL format', () => {
      expect(normalizeGitRemoteUrl('not-a-valid-url')).toBeNull()
    })

    it('lowercases the entire result', () => {
      expect(normalizeGitRemoteUrl('https://GitHub.COM/Owner/Repo.git')).toBe('github.com/owner/repo')
    })

    it('handles localhost proxy URL', () => {
      expect(normalizeGitRemoteUrl('http://proxy@localhost:8080/git/org/repo.git')).toBe('github.com/org/repo')
    })
  })
})
