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

### 2. userFacingName Type Guard (`src/components/messages/UserToolResultMessage/UserToolSuccessMessage.tsx:84`)
**Problem**: Runtime crash `TypeError: q6.userFacingName is not a function` when rendering tool success messages.
**Root cause**: Deserialized tool stubs from remote/transcript sources may lack the `userFacingName` method, and the code called it unconditionally.
**Fix**: Added `typeof tool.userFacingName === 'function'` guard before calling it.

### 3. Windows jq → Python Hook Fix (`~/.claude/plugins/.../compound-engineering/hooks/inject-skills.sh`)
**Problem**: `jq: command not found` error on Windows where Git Bash lacks `jq` binary.
**Fix**: Replaced all `jq -r` calls with `python3 -c "import sys,json; ..."` equivalents. Python 3.11 is available on the system and produces identical output.
