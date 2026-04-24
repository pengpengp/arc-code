import { describe, test, expect } from 'bun:test'
import type { SDKSessionOptions, Query, SDKSession, RuntimePermissionMode } from '../runtimeTypes.js'
import { resolveOptions } from '../sdkSessionContext.js'

describe('SDK resolveOptions', () => {
  test('resolves empty options', () => {
    const result = resolveOptions({})
    expect(result.model).toBeUndefined()
    expect(result.systemPrompt).toBeUndefined()
    expect(result.cwd).toBeUndefined()
  })

  test('resolves model option', () => {
    const result = resolveOptions({ model: 'claude-sonnet-4-6' })
    expect(result.model).toBe('claude-sonnet-4-6')
  })

  test('resolves systemPrompt option', () => {
    const result = resolveOptions({ systemPrompt: 'You are helpful' })
    expect(result.systemPrompt).toBe('You are helpful')
  })

  test('resolves appendSystemPrompt option', () => {
    const result = resolveOptions({ appendSystemPrompt: 'Always be concise' })
    expect(result.appendSystemPrompt).toBe('Always be concise')
  })

  test('resolves maxTurns option', () => {
    const result = resolveOptions({ maxTurns: 10 })
    expect(result.maxTurns).toBe(10)
  })

  test('resolves maxBudgetUsd option', () => {
    const result = resolveOptions({ maxBudgetUsd: 5.0 })
    expect(result.maxBudgetUsd).toBe(5.0)
  })

  test('resolves cwd option', () => {
    const result = resolveOptions({ cwd: '/tmp/project' })
    expect(result.cwd).toBe('/tmp/project')
  })

  test('resolves verbose option', () => {
    const result = resolveOptions({ verbose: true })
    expect(result.verbose).toBe(true)
  })

  test('resolves permissionMode option', () => {
    const result = resolveOptions({ permissionMode: 'bypassPermissions' })
    expect(result.permissionMode).toBe('bypassPermissions')
  })

  test('resolves effort option', () => {
    const result = resolveOptions({ effort: 'high' })
    expect(result.effort).toBe('high')
  })

  test('resolves fallbackModel option', () => {
    const result = resolveOptions({ fallbackModel: 'claude-haiku-4-5' })
    expect(result.fallbackModel).toBe('claude-haiku-4-5')
  })

  test('resolves env option', () => {
    const result = resolveOptions({ env: { ANTHROPIC_API_KEY: 'sk-test' } })
    expect(result.env).toEqual({ ANTHROPIC_API_KEY: 'sk-test' })
  })

  test('resolves jsonSchema option', () => {
    const result = resolveOptions({ jsonSchema: { type: 'object' } })
    expect(result.jsonSchema).toEqual({ type: 'object' })
  })

  test('resolves includePartialMessages option', () => {
    const result = resolveOptions({ includePartialMessages: true })
    expect(result.includePartialMessages).toBe(true)
  })

  test('resolves excludeDynamicSections option', () => {
    const result = resolveOptions({ excludeDynamicSections: true })
    expect(result.excludeDynamicSections).toBe(true)
  })

  test('resolves agentProgressSummaries option', () => {
    const result = resolveOptions({ agentProgressSummaries: true })
    expect(result.agentProgressSummaries).toBe(true)
  })

  test('resolves sdkMcpServers option', () => {
    const result = resolveOptions({ sdkMcpServers: ['my-server'] })
    expect(result.sdkMcpServers).toEqual(['my-server'])
  })

  test('resolves promptSuggestions option', () => {
    const result = resolveOptions({ promptSuggestions: true })
    expect(result.promptSuggestions).toBe(true)
  })

  test('resolves permissionToolName option', () => {
    const result = resolveOptions({ permissionToolName: 'stdio' })
    expect(result.permissionToolName).toBe('stdio')
  })
})

describe('SDK type interfaces', () => {
  test('Query interface has required methods', () => {
    const q: Query = {
      [Symbol.asyncIterator]: async function* () {},
      abort() {},
      getMessages: () => [],
      onAbort(_cb: () => void) {},
      isAborted: false,
      sessionId: 'test-session-id',
    }
    expect(typeof q.abort).toBe('function')
    expect(typeof q.getMessages).toBe('function')
    expect(typeof q.onAbort).toBe('function')
    expect(q.isAborted).toBe(false)
    expect(q.sessionId).toBe('test-session-id')
  })

  test('SDKSession interface has required methods', () => {
    const s: SDKSession = {
      id: 'test-session',
      async send(_msg: string) {},
      stream: async function* () {},
      async close() {},
      interrupt() {},
      setModel(_model: string) {},
      setPermissionMode(_mode: RuntimePermissionMode) {},
      getMessages: () => [],
      async addMcpServer(_name: string, _config: any) {},
      async removeMcpServer(_name: string) {},
    }
    expect(s.id).toBe('test-session')
    expect(typeof s.send).toBe('function')
    expect(typeof s.stream).toBe('function')
    expect(typeof s.close).toBe('function')
    expect(typeof s.interrupt).toBe('function')
    expect(typeof s.setModel).toBe('function')
    expect(typeof s.setPermissionMode).toBe('function')
    expect(typeof s.getMessages).toBe('function')
    expect(typeof s.addMcpServer).toBe('function')
    expect(typeof s.removeMcpServer).toBe('function')
  })

  test('SDKSessionOptions has all typed fields', () => {
    const opts: SDKSessionOptions = {
      model: 'claude-sonnet-4-6',
      systemPrompt: 'test',
      appendSystemPrompt: 'more',
      maxTurns: 10,
      maxBudgetUsd: 5.0,
      cwd: '/tmp',
      verbose: true,
      permissionMode: 'bypassPermissions',
      effort: 'high',
      fallbackModel: 'claude-haiku-4-5',
      includePartialMessages: true,
      replayUserMessages: false,
      excludeDynamicSections: true,
      agentProgressSummaries: false,
      promptSuggestions: true,
      permissionToolName: 'stdio',
      sdkMcpServers: ['server1'],
      env: { KEY: 'value' },
      jsonSchema: { type: 'object' },
    }
    expect(opts.model).toBe('claude-sonnet-4-6')
    expect(opts.effort).toBe('high')
    expect(opts.env?.KEY).toBe('value')
  })
})
