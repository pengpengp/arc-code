import { randomUUID } from 'crypto'
import { QueryEngine, type QueryEngineConfig } from '../../QueryEngine.js'
import type { SDKMessage, SDKResultMessage, SDKUserMessage } from './coreTypes.js'
import type { Query, SDKSession, SDKSessionOptions, RuntimePermissionMode } from './runtimeTypes.js'
import { getDefaultAppState } from '../../state/AppStateStore.js'
import { createStore, type Store } from '../../state/store.js'
import { getTools, filterToolsByDenyRules } from '../../tools.js'
import { getEmptyToolPermissionContext, type ToolPermissionContext, type Tool, type Tools } from '../../Tool.js'
import { hasPermissionsToUseTool } from '../../utils/permissions/permissions.js'
import { createFileStateCacheWithSizeLimit, READ_FILE_STATE_CACHE_SIZE, type FileStateCache } from '../../utils/fileStateCache.js'
import { getCwd } from '../../utils/cwd.js'
import { loadConversationForResume } from '../../utils/conversationRecovery.js'
import { logForDebugging } from '../../utils/debug.js'
import type { Command } from '../../commands.js'
import type { MCPServerConnection, ScopedMcpServerConfig } from '../../services/mcp/types.js'
import { getMcpToolsCommandsAndResources } from '../../services/mcp/client.js'
import { getAllMcpConfigs } from '../../services/mcp/config.js'
import type { AgentDefinition } from '../../tools/AgentTool/loadAgentsDir.js'
import type { CanUseToolFn } from '../../hooks/useCanUseTool.js'
import type { AppState } from '../../state/AppStateStore.js'
import type { Message } from '../../types/message.js'
import type { ThinkingConfig } from '../../utils/thinking.js'
import uniqBy from 'lodash-es/uniqBy.js'

export function resolveOptions(raw: SDKSessionOptions): SDKSessionOptions {
  return raw
}

type SessionContext = {
  config: Omit<QueryEngineConfig, 'initialMessages'>
  store: Store<AppState>
  readFileCache: FileStateCache
  cleanupFns: Array<() => Promise<void>>
  sessionId: string
  env?: Record<string, string>
  permissionToolName?: string
  excludeDynamicSections?: boolean
  agentProgressSummaries?: boolean
  promptSuggestions?: boolean
}

async function connectMcpServers(
  store: Store<AppState>,
  mcpConfigsOverride?: Record<string, ScopedMcpServerConfig>,
  sdkMcpServers?: string[],
): Promise<{ clients: MCPServerConnection[]; tools: Tools; commands: Command[] }> {
  const clients: MCPServerConnection[] = []
  const tools: Tool[] = []
  const commands: Command[] = []

  try {
    const configs = mcpConfigsOverride ?? (await getAllMcpConfigs()).servers
    const filteredConfigs: Record<string, ScopedMcpServerConfig> = {}
    for (const [name, config] of Object.entries(configs)) {
      if (config.type !== 'sdk') {
        filteredConfigs[name] = config
      } else if (sdkMcpServers?.includes(name)) {
        filteredConfigs[name] = config
      }
    }

    if (Object.keys(filteredConfigs).length === 0) return { clients, tools, commands }

    await getMcpToolsCommandsAndResources(({ client, tools: serverTools, commands: serverCommands }) => {
      clients.push(client)
      tools.push(...serverTools)
      commands.push(...serverCommands)

      store.setState(prev => ({
        ...prev,
        mcp: {
          ...prev.mcp,
          clients: prev.mcp.clients.some(c => c.name === client.name)
            ? prev.mcp.clients.map(c => c.name === client.name ? client : c)
            : [...prev.mcp.clients, client],
          tools: uniqBy([...prev.mcp.tools, ...serverTools], 'name'),
          commands: uniqBy([...prev.mcp.commands, ...serverCommands], 'name'),
        },
      }))
    }, filteredConfigs)
  } catch (e) {
    logForDebugging(`[SDK] MCP connection failed: ${e}`)
  }

  return { clients, tools, commands }
}

async function createSDKSessionContext(
  options: SDKSessionOptions,
  sessionId?: string,
): Promise<SessionContext> {
  const cwd = options.cwd ?? getCwd()

  const defaultState = getDefaultAppState()
  const permissionContext: ToolPermissionContext = {
    ...getEmptyToolPermissionContext(),
    mode: (options.permissionMode as ToolPermissionContext['mode']) ?? 'bypassPermissions',
    isBypassPermissionsModeAvailable: true,
  }

  const initialState: AppState = {
    ...defaultState,
    toolPermissionContext: permissionContext,
    sessionHooks: options.hooks
      ? new Map(Object.entries(options.hooks))
      : defaultState.sessionHooks,
  }

  const store = createStore(initialState)

  let tools: Tools = []
  try {
    tools = getTools(permissionContext)
  } catch {
    logForDebugging('[SDK] getTools failed, using empty tool set')
  }

  const canUseTool: CanUseToolFn = async (tool, input, context, assistantMessage, toolUseID, forceDecision) => {
    if (forceDecision) return forceDecision
    try {
      return await hasPermissionsToUseTool(tool, input, context, assistantMessage, toolUseID)
    } catch {
      return { behavior: 'allow' as const }
    }
  }

  const readFileCache = createFileStateCacheWithSizeLimit(READ_FILE_STATE_CACHE_SIZE)

  const cleanupFns: Array<() => Promise<void>> = []

  if (options.env && Object.keys(options.env).length > 0) {
    const originals: Record<string, string | undefined> = {}
    for (const [key, value] of Object.entries(options.env)) {
      originals[key] = process.env[key]
      process.env[key] = value
    }
    cleanupFns.push(async () => {
      for (const [key, original] of Object.entries(originals)) {
        if (original === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = original
        }
      }
    })
  }

  const { clients: mcpClients, tools: mcpTools, commands: mcpCommands } = await connectMcpServers(store, options.mcpConfigs, options.sdkMcpServers)

  for (const client of mcpClients) {
    if (client.type === 'connected' && client.cleanup) {
      cleanupFns.push(client.cleanup)
    }
  }

  const allowedMcpTools = filterToolsByDenyRules(mcpTools, permissionContext)
  const allTools = [...tools, ...allowedMcpTools]

  const allCommands = uniqBy([...mcpCommands], 'name')

  const agents: AgentDefinition[] = options.agents ?? []

  const thinkingConfig: ThinkingConfig | undefined = options.thinkingConfig ?? (
    options.effort ? { type: 'enabled', budgetTokens: effortToTokens(options.effort) } as ThinkingConfig : undefined
  )

  const config: Omit<QueryEngineConfig, 'initialMessages'> = {
    cwd,
    tools: allTools,
    commands: allCommands,
    mcpClients,
    agents,
    canUseTool,
    getAppState: store.getState,
    setAppState: store.setState,
    readFileCache,
    customSystemPrompt: options.systemPrompt,
    appendSystemPrompt: options.appendSystemPrompt,
    userSpecifiedModel: options.model,
    fallbackModel: options.fallbackModel,
    maxTurns: options.maxTurns,
    maxBudgetUsd: options.maxBudgetUsd,
    verbose: options.verbose,
    thinkingConfig,
    jsonSchema: options.jsonSchema,
    includePartialMessages: options.includePartialMessages,
    replayUserMessages: options.replayUserMessages,
    abortController: options.abortController,
  }

  return {
    config,
    store,
    readFileCache,
    cleanupFns,
    sessionId: sessionId ?? randomUUID(),
    env: options.env,
    permissionToolName: options.permissionToolName,
    excludeDynamicSections: options.excludeDynamicSections,
    agentProgressSummaries: options.agentProgressSummaries,
    promptSuggestions: options.promptSuggestions,
  }
}

function effortToTokens(effort: string): number {
  switch (effort) {
    case 'low': return 1024
    case 'medium': return 8192
    case 'high': return 32768
    case 'max': return 65536
    default: return 8192
  }
}

export class SDKSessionImpl implements SDKSession {
  readonly id: string
  private engine: QueryEngine | null = null
  private pendingPrompt: string | null = null
  private closed = false
  private context: SessionContext | null = null

  constructor(id: string, context: SessionContext, initialMessages?: Message[]) {
    this.id = id
    this.context = context
    this.engine = new QueryEngine({
      ...context.config,
      initialMessages: initialMessages ?? [],
    })
  }

  async send(message: string): Promise<void> {
    if (this.closed) throw new Error('Session is closed')
    if (this.pendingPrompt !== null) throw new Error('Previous message not yet streamed')
    this.pendingPrompt = message
  }

  async *stream(): AsyncGenerator<SDKMessage, void, unknown> {
    if (this.closed) throw new Error('Session is closed')
    if (this.pendingPrompt === null) throw new Error('No message sent. Call send() first.')
    if (!this.engine) throw new Error('Session engine not initialized')

    const prompt = this.pendingPrompt
    this.pendingPrompt = null

    yield* this.engine.submitMessage(prompt)
  }

  async close(): Promise<void> {
    this.closed = true
    if (this.engine) {
      this.engine.interrupt()
      this.engine = null
    }
    if (this.context) {
      for (const cleanup of this.context.cleanupFns) {
        try {
          await cleanup()
        } catch {
          // ignore cleanup errors
        }
      }
      this.context = null
    }
  }

  interrupt(): void {
    if (this.engine) {
      this.engine.interrupt()
    }
  }

  setModel(model: string): void {
    if (this.engine) {
      this.engine.setModel(model)
    }
  }

  setPermissionMode(mode: RuntimePermissionMode): void {
    if (!this.context) return
    this.context.store.setState(prev => ({
      ...prev,
      toolPermissionContext: {
        ...prev.toolPermissionContext,
        mode: mode as ToolPermissionContext['mode'],
      },
    }))
  }

  getMessages(): readonly unknown[] {
    if (this.engine) {
      return this.engine.getMessages()
    }
    return []
  }

  async addMcpServer(name: string, config: ScopedMcpServerConfig): Promise<void> {
    if (!this.context) throw new Error('Session is closed')
    const { clients, tools, commands } = await connectMcpServers(this.context.store, { [name]: config })
    for (const client of clients) {
      if (client.type === 'connected' && client.cleanup) {
        this.context.cleanupFns.push(client.cleanup)
      }
    }
    this.context.store.setState(prev => ({
      ...prev,
      mcp: {
        ...prev.mcp,
        clients: [...prev.mcp.clients, ...clients],
        tools: uniqBy([...prev.mcp.tools, ...tools], 'name'),
        commands: uniqBy([...prev.mcp.commands, ...commands], 'name'),
      },
    }))
  }

  async removeMcpServer(name: string): Promise<void> {
    if (!this.context) throw new Error('Session is closed')
    this.context.store.setState(prev => ({
      ...prev,
      mcp: {
        ...prev.mcp,
        clients: prev.mcp.clients.filter(c => c.name !== name),
        tools: prev.mcp.tools.filter(t => !('mcpInfo' in t && (t as any).mcpInfo?.serverName === name)),
        commands: prev.mcp.commands.filter(c => !('mcpInfo' in c && (c as any).mcpInfo?.serverName === name)),
      },
    }))
  }
}

export async function createSession(
  options: SDKSessionOptions,
): Promise<SDKSession> {
  const sessionId = randomUUID()
  const context = await createSDKSessionContext(options, sessionId)
  return new SDKSessionImpl(sessionId, context)
}

export async function resumeSession(
  sessionId: string,
  options: SDKSessionOptions,
): Promise<SDKSession> {
  let initialMessages: Message[] = []
  try {
    const result = await loadConversationForResume(sessionId, undefined)
    initialMessages = result.messages
  } catch (e) {
    logForDebugging(`[SDK] resumeSession: failed to load conversation: ${e}`)
  }

  const context = await createSDKSessionContext(options, sessionId)
  return new SDKSessionImpl(sessionId, context, initialMessages)
}

export function queryImpl(
  prompt: string | AsyncIterable<SDKUserMessage>,
  options?: SDKSessionOptions,
): Query {
  const sessionId = randomUUID()

  let engineRef: QueryEngine | null = null
  let contextRef: SessionContext | null = null
  const messages: SDKMessage[] = []
  const abortCallbacks: Array<() => void> = []
  let _isAborted = false

  const contextPromise = createSDKSessionContext(options ?? {}, sessionId)

  const asyncIterable: AsyncIterable<SDKMessage> = {
    [Symbol.asyncIterator]: async function* () {
      const context = await contextPromise
      contextRef = context

      const engine = new QueryEngine({
        ...context.config,
        initialMessages: [],
      })
      engineRef = engine

      if (_isAborted) {
        engine.interrupt()
        return
      }

      try {
        if (typeof prompt === 'string') {
          for await (const msg of engine.submitMessage(prompt)) {
            messages.push(msg)
            yield msg
            if (_isAborted) break
          }
        } else {
          for await (const userMessage of prompt) {
            if (_isAborted) break
            const content = (userMessage as Record<string, unknown>)?.message
              ? ((userMessage as Record<string, unknown>).message as Record<string, unknown>)?.content
              : (userMessage as Record<string, unknown>)?.content
            const text = typeof content === 'string'
              ? content
              : Array.isArray(content)
                ? content.map((b: unknown) => (b as { text?: string })?.text ?? '').join('')
                : String(content ?? '')
            for await (const msg of engine.submitMessage(text)) {
              messages.push(msg)
              yield msg
              if (_isAborted) break
            }
          }
        }
      } finally {
        engine.interrupt()
        for (const cleanup of context.cleanupFns) {
          try { await cleanup() } catch { /* ignore */ }
        }
      }
    },
  }

  return {
    [Symbol.asyncIterator]: asyncIterable[Symbol.asyncIterator].bind(asyncIterable),
    sessionId,
    abort() {
      _isAborted = true
      if (engineRef) engineRef.interrupt()
      for (const cb of abortCallbacks) {
        try { cb() } catch { /* ignore */ }
      }
    },
    getMessages(): readonly unknown[] {
      return messages
    },
    onAbort(callback: () => void): void {
      abortCallbacks.push(callback)
    },
    get isAborted(): boolean {
      return _isAborted
    },
  }
}

export async function promptImpl(
  message: string,
  options: SDKSessionOptions,
): Promise<SDKResultMessage> {
  let result: SDKResultMessage | null = null

  const q = queryImpl(message, options)

  for await (const msg of q) {
    if (msg.type === 'result') {
      result = msg as SDKResultMessage
    }
  }

  if (!result) {
    result = {
      type: 'result',
      subtype: 'error_during_execution',
      is_error: true,
      result: 'No result message received from query',
      duration_ms: 0,
      session_id: q.sessionId,
      uuid: randomUUID(),
    }
  }

  return result
}
