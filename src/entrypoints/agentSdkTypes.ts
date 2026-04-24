/**
 * Main entrypoint for Claude Code Agent SDK types.
 *
 * This file re-exports the public SDK API from:
 * - sdk/coreTypes.ts - Common serializable types (messages, configs)
 * - sdk/runtimeTypes.ts - Non-serializable types (callbacks, interfaces)
 *
 * SDK builders who need control protocol types should import from
 * sdk/controlTypes.ts directly.
 */

// Control protocol types for SDK builders (bridge subpath consumers)
/** @alpha */
export type {
  SDKControlRequest,
  SDKControlResponse,
} from './sdk/controlTypes.js'
// Re-export core types (common serializable types)
export * from './sdk/coreTypes.js'
// Re-export runtime types (callbacks, interfaces with methods)
export * from './sdk/runtimeTypes.js'

// Re-export settings types (generated from settings JSON schema)
export type { Settings } from './sdk/settingsTypes.generated.js'
// Re-export tool types (all marked @internal until SDK API stabilizes)
export * from './sdk/toolTypes.js'

// ============================================================================
// Functions — delegate to implementation
// ============================================================================

import type {
  SDKMessage,
  SDKResultMessage,
  SDKSessionInfo,
  SDKUserMessage,
} from './sdk/coreTypes.js'
import type {
  AnyZodRawShape,
  ForkSessionOptions,
  ForkSessionResult,
  GetSessionInfoOptions,
  GetSessionMessagesOptions,
  InferShape,
  InternalOptions,
  InternalQuery,
  ListSessionsOptions,
  McpSdkServerConfigWithInstance,
  Options,
  Query,
  SDKSession,
  SDKSessionOptions,
  SdkMcpToolDefinition,
  SessionMessage,
  SessionMutationOptions,
} from './sdk/runtimeTypes.js'
import type {
  CallToolResult,
  ToolAnnotations,
} from '@modelcontextprotocol/sdk/types.js'

export type {
  ListSessionsOptions,
  GetSessionInfoOptions,
  SessionMutationOptions,
  ForkSessionOptions,
  ForkSessionResult,
  SDKSessionInfo,
}

// Re-export all implemented functions
export {
  tool,
  createSdkMcpServer,
  listSessions,
  getSessionInfo,
  getSessionMessages,
  renameSession,
  tagSession,
  forkSession,
  watchScheduledTasks,
  buildMissedTaskNotification,
  connectRemoteControl,
  AbortError,
  unstable_v2_createSession,
  unstable_v2_resumeSession,
  unstable_v2_prompt,
} from './sdk/agentSdkImpl.js'

// Types for daemon primitives
export type { CronTaskType as CronTask, CronJitterConfigType as CronJitterConfig, ScheduledTaskEvent, ScheduledTasksHandle } from './sdk/agentSdkImpl.js'
export type { InboundPrompt, ConnectRemoteControlOptions, RemoteControlHandle } from './sdk/agentSdkImpl.js'

export function query(params: {
  prompt: string | AsyncIterable<SDKUserMessage>
  options?: SDKSessionOptions
}): Query {
  const { queryImpl } = require('./sdk/sdkSessionContext.js') as typeof import('./sdk/sdkSessionContext.js')
  return queryImpl(params.prompt, params.options)
}
