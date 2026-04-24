export type SDKControlRequestInner =
  | { subtype: 'interrupt' }
  | { subtype: 'can_use_tool'; tool_name: string; tool_input: Record<string, unknown>; decision_classification?: string }
  | { subtype: 'initialize'; hooks?: Record<string, unknown>; sdkMcpServers?: string[]; jsonSchema?: Record<string, unknown>; systemPrompt?: string; appendSystemPrompt?: string; agents?: Record<string, unknown>; promptSuggestions?: boolean; agentProgressSummaries?: boolean }
  | { subtype: 'set_permission_mode'; mode: string }
  | { subtype: 'set_model'; model: string }
  | { subtype: 'set_max_thinking_tokens'; budget_tokens: number }
  | { subtype: 'mcp_status' }
  | { subtype: 'get_context_usage' }
  | { subtype: 'hook_callback'; hook_event_name: string; hook_input: unknown }
  | { subtype: 'mcp_message'; server_name: string; message: unknown }
  | { subtype: 'mcp_set_servers'; servers: Record<string, unknown> }
  | { subtype: 'mcp_reconnect'; server_name: string }
  | { subtype: 'mcp_toggle'; server_name: string; enabled: boolean }
  | { subtype: 'rewind_files'; message_uuid: string }
  | { subtype: 'cancel_async_message'; message_uuid: string }
  | { subtype: 'seed_read_state'; read_state: unknown }
  | { subtype: 'reload_plugins' }
  | { subtype: 'stop_task'; task_id: string }
  | { subtype: 'apply_flag_settings'; settings: Record<string, unknown> }
  | { subtype: 'get_settings' }
  | { subtype: 'elicitation'; server_name: string; message: string; mode?: string; url?: string; elicitation_id?: string }

export type SDKControlRequest = {
  type: 'control_request'
  request_id: string
  request: SDKControlRequestInner
}

export type SDKControlResponse = {
  type: 'control_response'
  response:
    | { subtype: 'success'; request_id: string; response?: unknown }
    | { subtype: 'error'; request_id: string; error: string }
}

export type SDKControlCancelRequest = {
  type: 'control_cancel_request'
  request_id: string
}

export type StdoutMessage =
  | unknown
  | SDKControlRequest
  | SDKControlResponse
  | SDKControlCancelRequest

export type StdinMessage =
  | unknown
  | SDKControlRequest
  | SDKControlResponse
  | { type: 'keep_alive' }
  | { type: 'update_environment_variables'; variables: Record<string, string> }
