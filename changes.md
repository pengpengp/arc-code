# Codex API Support: Feature Parity & UI Overhaul

---

# v2.1.87 Quality & SDK Completeness Pass (2026-04-24)

## Summary
Comprehensive quality improvement pass covering stability fixes, Agent SDK implementation, feature flag activation, type system unification, and performance optimizations. All 15 Agent SDK public APIs are now fully implemented. All 38 experimental feature flags are enabled by default in every build variant.

## Key Changes

### 1. Agent SDK — Full Implementation (0 → 15 APIs)

All 15 public SDK APIs are now implemented with QueryEngine deep integration:

| API | Status |
|---|---|
| `query({ prompt, options })` | ✅ Streaming AsyncIterable with abort/sessionId |
| `unstable_v2_createSession(options)` | ✅ Multi-turn session with send/stream/close |
| `unstable_v2_resumeSession(sessionId, options)` | ✅ Resume from saved conversation |
| `unstable_v2_prompt(message, options)` | ✅ One-shot prompt returning SDKResultMessage |
| `tool(name, desc, schema, handler)` | ✅ MCP tool definition factory |
| `createSdkMcpServer(options)` | ✅ MCP server with stdio transport |
| `listSessions(options?)` | ✅ List saved sessions |
| `getSessionInfo(sessionId, options?)` | ✅ Get session metadata |
| `getSessionMessages(sessionId, options?)` | ✅ Get session messages with pagination |
| `renameSession(sessionId, title, options?)` | ✅ Rename a session |
| `tagSession(sessionId, tag, options?)` | ✅ Tag a session |
| `forkSession(sessionId, options?)` | ✅ Fork with UUID remapping |
| `watchScheduledTasks(opts)` | ✅ Cron scheduler with event stream |
| `buildMissedTaskNotification(tasks)` | ✅ Missed task notification builder |
| `connectRemoteControl(opts)` | ✅ Bridge-based remote control via WebSocket/SSE |

**SDKSession methods**: `send()`, `stream()`, `close()`, `interrupt()`, `setModel()`, `setPermissionMode()`, `getMessages()`, `addMcpServer()`, `removeMcpServer()`

**SDKSessionOptions**: 22 typed fields including `env` (scoped environment variables), `hooks`, `agents`, `mcpConfigs`, `sdkMcpServers`, `permissionToolName`, `excludeDynamicSections`, `agentProgressSummaries`, `promptSuggestions`

**SDKMessage types**: Expanded from 11 to 29 message types covering rate limits, hooks, tasks, auth, elicitation, etc.

### 2. Feature Flags — All 38 Enabled by Default

Changed `defaultFeatures` in `scripts/build.ts` from `[VOICE_MODE]` to `[...fullExperimentalFeatures]`. Every build variant (`build`, `build:dev`, `build:dev:full`, `compile`) now includes all 38 experimental feature flags.

### 3. Stability & Bug Fixes

- **Timeout fix**: `sessionFileAccessHooks.ts` timeout changed from 1ms to 1000ms
- **Memory leak fixes**: Unbounded `Map` caches replaced with `LRUCache` (max 500/200 entries) in `memoize.ts` and `growthbook.ts`
- **Silent error swallowing**: Added proper error logging in `main.tsx`, `replBridge.ts`, `gracefulShutdown.ts`, `LSPServerInstance.ts`, `mcp/client.ts`
- **Resource limits**: `WebBrowserTool` MAX_SESSIONS=10, `SubscribePRTool` MAX_SUBSCRIPTIONS=50
- **String concatenation**: Repeated `+=` on strings replaced with array `.join()` in `render-to-screen.ts`, `ripgrep.ts`, `createSSHSession.ts`, `dream.ts`
- **Buffer concatenation**: `Buffer.concat` used instead of string concatenation in `ripgrep.ts`
- **Promise parallelization**: Sequential `await` calls parallelized with `Promise.all` in `cacheUtils.ts`
- **Recursion guard**: `MAX_RECURSION_DEPTH=64` added to `squash-text-nodes.ts`
- **setTimeout cleanup**: Timer cleanup added in `REPL.tsx`
- **setImmediate safety**: try-catch around `setImmediate` in `SendMessageTool.ts`
- **Regex fix**: Unsafe regex in `torch.ts`
- **Process exit**: `process.exit(0)` added in `main.tsx` catch block

### 4. Type System Unification

- **3 missing type files created**: `controlTypes.ts`, `settingsTypes.generated.ts`, `sdkUtilityTypes.ts`
- **HookEvent unified**: Re-exported from `coreTypes.generated.ts` (was 3 separate definitions)
- **PermissionMode unified**: Re-exported from `coreTypes.generated.ts` with `RuntimePermissionMode` extension
- **toolTypes.ts populated**: Exports `ToolInputJSONSchema`, `ValidationResult`, `AnyObject`
- **tsconfig.json**: Added `noImplicitReturns: true`

### 5. SDK Session Safety

- **No global state pollution**: Removed `switchSession()`/`setCwdState()`/`setOriginalCwd()` calls from `createSDKSessionContext` — concurrent sessions no longer conflict
- **Scoped environment variables**: `options.env` applies to `process.env` with automatic cleanup on session close
- **Session ID isolation**: `promptImpl` uses `Query.sessionId` instead of global `getSessionId()`
- **MCP server filtering**: `sdkMcpServers` option controls which SDK-type MCP servers are connected
- **AsyncLocalStorage-ready**: Session context stores all config locally, no global singleton dependencies

### 6. New Files

- `src/entrypoints/sdk/agentSdkImpl.ts` — All 15 SDK API implementations
- `src/entrypoints/sdk/sdkSessionContext.ts` — Session management (Query/SDKSession/SessionContext)
- `src/entrypoints/sdk/controlTypes.ts` — Control protocol types (21 subtypes)
- `src/entrypoints/sdk/settingsTypes.generated.ts` — Settings schema types
- `src/entrypoints/sdk/sdkUtilityTypes.ts` — Utility types (token usage)
- `src/entrypoints/sdk/__tests__/integration.test.ts` — 8 integration tests
- `src/entrypoints/sdk/__tests__/sdkSessionContext.test.ts` — 22 unit tests
- `src/utils/zodErrors.ts` — Shared `formatZodIssues()` utility

### 7. Modified Files

- `scripts/build.ts` — `defaultFeatures = [...fullExperimentalFeatures]`
- `src/entrypoints/agentSdkTypes.ts` — Re-exports all SDK functions and types
- `src/entrypoints/sdk/coreTypes.generated.ts` — SDKMessage expanded to 29 types
- `src/entrypoints/sdk/runtimeTypes.ts` — Full SDKSessionOptions (22 fields), Query with sessionId, SDKSession with addMcpServer/removeMcpServer
- `src/entrypoints/sdk/toolTypes.ts` — Populated with tool type exports
- `src/utils/sessionFileAccessHooks.ts`, `src/tools/WebBrowserTool/WebBrowserTool.ts`, `src/tools/SubscribePRTool/SubscribePRTool.ts`, `src/utils/memoize.ts`, `src/services/analytics/growthbook.ts`, `src/main.tsx`, `src/bridge/replBridge.ts`, `src/utils/gracefulShutdown.ts`, `src/services/lsp/LSPServerInstance.ts`, `src/services/mcp/client.ts`, `src/utils/messages.ts`, `src/screens/REPL.tsx`, `src/utils/plugins/cacheUtils.ts`, `src/ink/render-to-screen.ts`, `src/utils/ripgrep.ts`, `src/ssh/createSSHSession.ts`, `src/dream.ts`, `src/ink/squash-text-nodes.ts`, `src/tools/SendMessageTool/SendMessageTool.ts`, `src/commands/torch.ts`, `tsconfig.json`

---

# Codex API Support: Feature Parity & UI Overhaul

## Summary
This pull request introduces full feature parity and explicit UI support for the OpenAI Codex backend (`chatgpt.com/backend-api/codex/responses`). The codebase is now entirely backend-agnostic and smoothly transitions between Anthropic Claude and OpenAI Codex schemas based on current authentication, without losing features like reasoning animations, token billing, or multi-modal visual inputs.

## Key Changes

### 1. Codex API Gateway Adapter (`codex-fetch-adapter.ts`)
- **Native Vision Translation**: Anthropic `base64` image schemas now map precisely to the Codex expected `input_image` payloads.
- **Strict Payload Mapping**: Refactored the internal mapping logic to translate `msg.content` items precisely into `input_text`, sidestepping OpenAI's strict `v1/responses` validation rules (`Invalid value: 'text'`).
- **Tool Logic Fixes**: Properly routed `tool_result` items into top-level `function_call_output` objects to guarantee that local CLI tool executions (File Reads, Bash loops) cleanly feed back into Codex logic without throwing "No tool output found" errors.
- **Cache Stripping**: Cleanly stripped Anthropic-only `cache_control` annotations from tool bindings and prompts prior to transmission so the Codex API doesn't reject malformed JSON.

### 2. Deep UI & Routing Integration
- **Model Cleanups (`model.ts`)**: Updated `getPublicModelDisplayName` and `getClaudeAiUserDefaultModelDescription` to recognize Codex GPT strings. Models like `gpt-5.1-codex-max` now beautifully map to `Codex 5.1 Max` in the CLI visual outputs instead of passing the raw proxy IDs.
- **Default Reroutes**: Made `getDefaultMainLoopModelSetting` aware of `isCodexSubscriber()`, automatically defaulting to `gpt-5.2-codex` instead of `sonnet46`.
- **Billing Visuals (`logoV2Utils.ts`)**: Refactored `formatModelAndBilling` logic to render `Codex API Billing` proudly inside the terminal header when authenticated.

### 3. Reasoning & Metrics Support
- **Thinking Animations**: `codex-fetch-adapter` now intentionally intercepts the proprietary `response.reasoning.delta` SSE frames emitted by `codex-max` models. It wraps them into Anthropic `<thinking>` events, ensuring the standard CLI "Thinking..." spinner continues to function flawlessly for OpenAI reasoning.
- **Token Accuracy**: Bound logic to track `response.completed` completion events, fetching `usage.input_tokens` and `output_tokens`. These are injected natively into the final `message_stop` token handler, meaning Codex queries correctly trigger the terminal's Token/Price tracker summary logic.

### 4. Git Housekeeping
- Configured `.gitignore` to securely and durably exclude the `openclaw/` gateway directory from staging commits.

---

# Fix: dev-full Build No Response + Windows Hook + Tool Crash

## Summary
Three fixes applied to restore dev-full build text visibility, Windows hook compatibility, and tool rendering stability.

## Fixes

### 1. Brief Mode Auto-Enable Removed (`src/main.tsx:~2910`)
**Problem**: In `dev-full` builds, sending any message resulted in no visible assistant response — the query completed successfully but all text was hidden in the UI.
**Root cause**: The `defaultView:'chat'` settings path auto-enabled `setUserMsgOptIn(true)` for every local REPL session when KAIROS activated. With `isBriefOnly=true`, `filterForBriefTool` in `Messages.tsx:112-158` returned `false` for all assistant text messages, leaving only tool_use blocks visible.
**Fix**: Removed the `defaultView` block that called `setUserMsgOptIn(true)`. Brief mode now requires explicit opt-in via `--tools Brief`, `--brief` flag, `CLAUDE_CODE_BRIEF` env var, or remote/assistant session.

### 2. userFacingName Type Guard (6 call sites)
**Problem**: Runtime crash `TypeError: q6.userFacingName is not a function` when rendering tool messages after long-running sessions.
**Root cause**: Deserialized tool stubs from remote/transcript sources may lack the `userFacingName` method, and 6 call sites called it unconditionally.
**Fix**: Added `typeof tool.userFacingName === 'function'` guards at all 6 call sites:
- `src/components/messages/AssistantToolUseMessage.tsx:77`
- `src/components/messages/CollapsedReadSearchContent.tsx:99`
- `src/components/messages/UserToolResultMessage/UserToolSuccessMessage.tsx:84` (already had guard)
- `src/components/tasks/renderToolActivity.tsx:15`
- `src/hooks/useCanUseTool.tsx:87`
- `src/tools/AgentTool/UI.tsx:852`

### 3. Windows jq → Python Hook Fix (`~/.claude/plugins/.../compound-engineering/hooks/inject-skills.sh`)
**Problem**: `jq: command not found` error on Windows where Git Bash lacks `jq` binary.
**Fix**: Replaced all `jq -r` calls with `python3 -c "import sys,json; ..."` equivalents. Python 3.11 is available on the system and produces identical output.
