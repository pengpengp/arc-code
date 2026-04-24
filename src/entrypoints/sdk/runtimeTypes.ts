import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import type { ZodTypeAny } from 'zod/v4'
import type { SDKMessage, SDKResultMessage, SDKUserMessage } from './coreTypes.js'
import type { HookEvent as CoreHookEvent, PermissionMode as CorePermissionMode } from './coreTypes.generated.js'

export type EffortLevel = 'low' | 'medium' | 'high' | 'max'

export type AnyZodRawShape = Record<string, ZodTypeAny>

export type InferShape<Schema extends AnyZodRawShape> = {
  [K in keyof Schema]?: unknown
}

export type SdkMcpToolDefinition<Schema extends AnyZodRawShape> = {
  name: string
  description: string
  inputSchema: Schema
  handler: (args: InferShape<Schema>, extra: unknown) => Promise<CallToolResult>
  annotations?: ToolAnnotations
  searchHint?: string
  alwaysLoad?: boolean
}

export type McpSdkServerConfigWithInstance = Record<string, unknown>

export type { CoreHookEvent as HookEvent }
export type { CorePermissionMode as PermissionMode }

export type RuntimePermissionMode = CorePermissionMode | 'auto' | 'dontAsk'

export type HookMatcher = {
  matcher?: string
  hooks: Array<{
    type: 'command'
    command: string
  }>
}

export type HookConfig = Partial<Record<CoreHookEvent, HookMatcher[]>>

export type SDKSessionOptions = {
  model?: string
  systemPrompt?: string
  appendSystemPrompt?: string
  maxTurns?: number
  maxBudgetUsd?: number
  cwd?: string
  verbose?: boolean
  thinkingConfig?: import('../../utils/thinking.js').ThinkingConfig
  permissionMode?: RuntimePermissionMode
  effort?: EffortLevel
  abortController?: AbortController
  env?: Record<string, string>
  hooks?: HookConfig
  agents?: Array<import('../../tools/AgentTool/loadAgentsDir.js').AgentDefinition>
  jsonSchema?: Record<string, unknown>
  fallbackModel?: string
  includePartialMessages?: boolean
  replayUserMessages?: boolean
  mcpConfigs?: Record<string, import('../../services/mcp/types.js').ScopedMcpServerConfig>
  permissionToolName?: string
  excludeDynamicSections?: boolean
  agentProgressSummaries?: boolean
  promptSuggestions?: boolean
  sdkMcpServers?: string[]
}

export type Options = SDKSessionOptions
export type InternalOptions = SDKSessionOptions

export interface Query extends AsyncIterable<SDKMessage> {
  abort(): void
  getMessages(): readonly unknown[]
  onAbort(callback: () => void): void
  readonly isAborted: boolean
  readonly sessionId: string
}

export type InternalQuery = Query

export type SessionMutationOptions = {
  dir?: string
}

export type ListSessionsOptions = SessionMutationOptions & {
  limit?: number
  offset?: number
}

export type GetSessionInfoOptions = SessionMutationOptions

export type GetSessionMessagesOptions = SessionMutationOptions & {
  limit?: number
  offset?: number
  includeSystemMessages?: boolean
}

export type ForkSessionOptions = SessionMutationOptions

export type ForkSessionResult = {
  sessionId: string
}

export interface SDKSession {
  readonly id: string
  send(message: string): Promise<void>
  stream(): AsyncIterable<SDKMessage>
  close(): Promise<void>
  interrupt(): void
  setModel(model: string): void
  setPermissionMode(mode: RuntimePermissionMode): void
  getMessages(): readonly unknown[]
  addMcpServer(name: string, config: import('../../services/mcp/types.js').ScopedMcpServerConfig): Promise<void>
  removeMcpServer(name: string): Promise<void>
}

export type SessionMessage = SDKMessage
