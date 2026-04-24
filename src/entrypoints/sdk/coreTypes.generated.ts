export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'plan'

export type ExitReason =
  | 'clear'
  | 'resume'
  | 'logout'
  | 'prompt_input_exit'
  | 'other'
  | 'bypass_permissions_disabled'

export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'Notification'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'SessionEnd'
  | 'Stop'
  | 'StopFailure'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'PreCompact'
  | 'PostCompact'
  | 'PermissionRequest'
  | 'PermissionDenied'
  | 'Setup'
  | 'TeammateIdle'
  | 'TaskCreated'
  | 'TaskCompleted'
  | 'Elicitation'
  | 'ElicitationResult'
  | 'ConfigChange'
  | 'WorktreeCreate'
  | 'WorktreeRemove'
  | 'InstructionsLoaded'
  | 'CwdChanged'
  | 'FileChanged'

export type ModelUsage = {
  costUSD?: number
  inputTokens?: number
  outputTokens?: number
  cacheCreationInputTokens?: number
  cacheReadInputTokens?: number
  [key: string]: number | undefined
}

export type SDKStatus = 'compacting' | string | null

export type SDKBaseMessage = {
  type: string
  subtype?: string
  uuid?: string
  session_id?: string
  [key: string]: unknown
}

export type SDKAssistantMessage = SDKBaseMessage & {
  type: 'assistant'
  message?: { content?: unknown[] }
}

export type SDKAssistantMessageError = SDKBaseMessage & {
  type: 'assistant_error'
  message?: string
}

export type SDKPartialAssistantMessage = SDKBaseMessage & {
  type: 'assistant_partial'
  delta?: string
}

export type SDKResultMessage = SDKBaseMessage & {
  type: 'result'
  is_error?: boolean
  result?: string
  duration_ms?: number
  total_cost_usd?: number
}

export type SDKStatusMessage = SDKBaseMessage & {
  type: 'status'
  status: SDKStatus
}

export type SDKSystemMessage = SDKBaseMessage & {
  type: 'system'
  content?: string
}

export type SDKCompactBoundaryMessage = SDKSystemMessage & {
  subtype: 'compact_boundary' | 'microcompact_boundary'
}

export type SDKToolProgressMessage = SDKBaseMessage & {
  type: 'tool_progress'
  data?: Record<string, unknown>
}

export type SDKPermissionDenial = SDKBaseMessage & {
  type: 'permission_denial'
  mode?: PermissionMode
  toolName?: string
}

export type SDKRateLimitInfo = {
  remaining?: number
  resetAt?: string
}

export type SDKUserMessage = SDKBaseMessage & {
  type: 'user'
  message?: { content?: unknown }
}

export type SDKUserMessageReplay = SDKUserMessage & {
  isReplay?: boolean
}

export type SDKSessionInfo = {
  sessionId: string
  summary?: string
  cwd?: string
  createdAt?: string
  updatedAt?: string
}

export type PermissionResult =
  | { behavior: 'allow'; updatedInput?: Record<string, unknown> }
  | { behavior: 'deny'; message?: string }
  | { behavior: 'ask'; updatedInput?: Record<string, unknown>; message?: string }

export type HookInput = {
  session_id?: string
  event?: HookEvent
  [key: string]: unknown
}

export type HookJSONOutput = {
  continue?: boolean
  stopReason?: string
  message?: string
  decision?: 'allow' | 'deny' | 'ask'
  [key: string]: unknown
}

export type SyncHookJSONOutput = HookJSONOutput

export type AsyncHookJSONOutput = HookJSONOutput & {
  waitMs?: number
}

export type SDKRateLimitEvent = SDKBaseMessage & {
  type: 'rate_limit'
  limit?: number
  remaining?: number
  resetAt?: number
}

export type SDKStreamlinedTextMessage = SDKBaseMessage & {
  type: 'streamlined_text'
  text?: string
}

export type SDKStreamlinedToolUseSummaryMessage = SDKBaseMessage & {
  type: 'streamlined_tool_use_summary'
  tool_name?: string
  tool_input?: Record<string, unknown>
  summary?: string
}

export type SDKPostTurnSummaryMessage = SDKBaseMessage & {
  type: 'post_turn_summary'
  summary?: string
}

export type SDKAPIRetryMessage = SDKBaseMessage & {
  type: 'api_retry'
  attempt?: number
  maxAttempts?: number
  delayMs?: number
}

export type SDKLocalCommandOutputMessage = SDKBaseMessage & {
  type: 'local_command_output'
  command?: string
  output?: string
  exitCode?: number
}

export type SDKHookStartedMessage = SDKBaseMessage & {
  type: 'hook_started'
  hook_event_name?: string
  hook_id?: string
}

export type SDKHookProgressMessage = SDKBaseMessage & {
  type: 'hook_progress'
  hook_id?: string
  progress?: string
}

export type SDKHookResponseMessage = SDKBaseMessage & {
  type: 'hook_response'
  hook_id?: string
  output?: HookJSONOutput
}

export type SDKAuthStatusMessage = SDKBaseMessage & {
  type: 'auth_status'
  authenticated?: boolean
  authVersion?: number
}

export type SDKFilesPersistedEvent = SDKBaseMessage & {
  type: 'files_persisted'
  files?: string[]
}

export type SDKTaskNotificationMessage = SDKBaseMessage & {
  type: 'task_notification'
  task_id?: string
  notification?: string
}

export type SDKTaskStartedMessage = SDKBaseMessage & {
  type: 'task_started'
  task_id?: string
  task_name?: string
}

export type SDKTaskProgressMessage = SDKBaseMessage & {
  type: 'task_progress'
  task_id?: string
  progress?: number
  message?: string
}

export type SDKSessionStateChangedMessage = SDKBaseMessage & {
  type: 'session_state_changed'
  state?: string
}

export type SDKToolUseSummaryMessage = SDKBaseMessage & {
  type: 'tool_use_summary'
  tool_name?: string
  tool_input?: Record<string, unknown>
  result_summary?: string
}

export type SDKElicitationCompleteMessage = SDKBaseMessage & {
  type: 'elicitation_complete'
  elicitation_id?: string
  response?: string
}

export type SDKPromptSuggestionMessage = SDKBaseMessage & {
  type: 'prompt_suggestion'
  text?: string
  promptId?: string
}

export type SDKMessage =
  | SDKAssistantMessage
  | SDKAssistantMessageError
  | SDKCompactBoundaryMessage
  | SDKPartialAssistantMessage
  | SDKPermissionDenial
  | SDKRateLimitEvent
  | SDKResultMessage
  | SDKStatusMessage
  | SDKStreamlinedTextMessage
  | SDKStreamlinedToolUseSummaryMessage
  | SDKPostTurnSummaryMessage
  | SDKAPIRetryMessage
  | SDKLocalCommandOutputMessage
  | SDKHookStartedMessage
  | SDKHookProgressMessage
  | SDKHookResponseMessage
  | SDKAuthStatusMessage
  | SDKFilesPersistedEvent
  | SDKTaskNotificationMessage
  | SDKTaskStartedMessage
  | SDKTaskProgressMessage
  | SDKSessionStateChangedMessage
  | SDKToolUseSummaryMessage
  | SDKElicitationCompleteMessage
  | SDKPromptSuggestionMessage
  | SDKSystemMessage
  | SDKToolProgressMessage
  | SDKUserMessage
  | SDKUserMessageReplay
