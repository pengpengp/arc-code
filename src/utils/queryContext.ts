/**
 * Shared helpers for building the API cache-key prefix (systemPrompt,
 * userContext, systemContext) for query() calls.
 *
 * Lives in its own file because it imports from context.ts and
 * constants/prompts.ts, which are high in the dependency graph. Putting
 * these imports in systemPrompt.ts or sideQuestion.ts (both reachable
 * from commands.ts) would create cycles. Only entrypoint-layer files
 * import from here (QueryEngine.ts, cli/print.ts).
 */

import type { Command } from '../commands.js'
import { getSystemPrompt } from '../constants/prompts.js'
import { getSystemContext, getUserContext } from '../context.js'
import type { MCPServerConnection } from '../services/mcp/types.js'
import type { AppState } from '../state/AppStateStore.js'
import type { Tools, ToolUseContext } from '../Tool.js'
import type { AgentDefinition } from '../tools/AgentTool/loadAgentsDir.js'
import type { Message } from '../types/message.js'
import { createAbortController } from './abortController.js'
import type { FileStateCache } from './fileStateCache.js'
import type { CacheSafeParams } from './forkedAgent.js'
import { getMainLoopModel } from './model/model.js'
import { asSystemPrompt } from './systemPromptType.js'
import {
  shouldEnableThinkingByDefault,
  type ThinkingConfig,
} from './thinking.js'

// --- Cross-turn system prompt memoization ---
//
// getSystemPrompt() is expensive: it serializes tool schemas, reads CLAUDE.md
// files, runs git status, and assembles 10+ sections. Most turns don't change
// the inputs, so we can reuse the previous result.
//
// The cache key is a hash of: tool names (sorted), model ID, additional dirs
// (sorted), MCP client names (sorted). When none of these change, the result
// is returned synchronously without re-invoking getSystemPrompt().

type SysPromptCacheEntry = {
  key: string
  result: {
    defaultSystemPrompt: string[]
    userContext: { [k: string]: string }
    systemContext: { [k: string]: string }
  }
}

let sysPromptCrossTurnCache: SysPromptCacheEntry | null = null

/** Build a stable cache key from the system prompt inputs. */
function buildSysPromptCacheKey(
  tools: Tools,
  mainLoopModel: string,
  additionalWorkingDirectories: string[],
  mcpClients: MCPServerConnection[],
): string {
  const toolNames = tools.map(t => t.name).sort().join(',')
  const dirs = [...additionalWorkingDirectories].sort().join('|')
  const mcpNames = mcpClients.map(c => c.name).sort().join(',')
  return `${toolNames}\x00${mainLoopModel}\x00${dirs}\x00${mcpNames}`
}

/**
 * Fetch the three context pieces that form the API cache-key prefix:
 * systemPrompt parts, userContext, systemContext.
 *
 * When customSystemPrompt is set, the default getSystemPrompt build and
 * getSystemContext are skipped — the custom prompt replaces the default
 * entirely, and systemContext would be appended to a default that isn't
 * being used.
 *
 * Cross-turn memoization: if tools, model, additional directories, and MCP
 * clients haven't changed since the last call, the previous result is reused
 * without recomputing. This saves ~50-200ms per turn (tool schema serialization
 * + CLAUDE.md reads + git status).
 *
 * Callers assemble the final systemPrompt from defaultSystemPrompt (or
 * customSystemPrompt) + optional extras + appendSystemPrompt. QueryEngine
 * injects coordinator userContext and memory-mechanics prompt on top;
 * sideQuestion's fallback uses the base result directly.
 */
export async function fetchSystemPromptParts({
  tools,
  mainLoopModel,
  additionalWorkingDirectories,
  mcpClients,
  customSystemPrompt,
}: {
  tools: Tools
  mainLoopModel: string
  additionalWorkingDirectories: string[]
  mcpClients: MCPServerConnection[]
  customSystemPrompt: string | undefined
}): Promise<{
  defaultSystemPrompt: string[]
  userContext: { [k: string]: string }
  systemContext: { [k: string]: string }
}> {
  // Custom prompt: skip memoization — caller is overriding everything.
  if (customSystemPrompt !== undefined) {
    const [userContext] = await Promise.all([getUserContext()])
    return { defaultSystemPrompt: [], userContext, systemContext: {} }
  }

  const cacheKey = buildSysPromptCacheKey(
    tools,
    mainLoopModel,
    additionalWorkingDirectories,
    mcpClients,
  )

  // Cache hit: reuse previous turn's system prompt (no recomputation needed).
  if (sysPromptCrossTurnCache !== null && sysPromptCrossTurnCache.key === cacheKey) {
    return sysPromptCrossTurnCache.result
  }

  // Cache miss: rebuild all three parts in parallel.
  const [defaultSystemPrompt, userContext, systemContext] = await Promise.all([
    getSystemPrompt(
      tools,
      mainLoopModel,
      additionalWorkingDirectories,
      mcpClients,
    ),
    getUserContext(),
    getSystemContext(),
  ])

  // Store for next turn.
  sysPromptCrossTurnCache = {
    key: cacheKey,
    result: { defaultSystemPrompt, userContext, systemContext },
  }

  return { defaultSystemPrompt, userContext, systemContext }
}

/** Clear the cross-turn system prompt cache. Call alongside clearSystemPromptSections() on /clear, /compact, and other cache-busting events. */
export function invalidateSysPromptCache(): void {
  sysPromptCrossTurnCache = null
}

/**
 * Build CacheSafeParams from raw inputs when getLastCacheSafeParams() is null.
 *
 * Used by the SDK side_question handler (print.ts) on resume before a turn
 * completes — there's no stopHooks snapshot yet. Mirrors the system prompt
 * assembly in QueryEngine.ts:ask() so the rebuilt prefix matches what the
 * main loop will send, preserving the cache hit in the common case.
 *
 * May still miss the cache if the main loop applies extras this path doesn't
 * know about (coordinator mode, memory-mechanics prompt). That's acceptable —
 * the alternative is returning null and failing the side question entirely.
 */
export async function buildSideQuestionFallbackParams({
  tools,
  commands,
  mcpClients,
  messages,
  readFileState,
  getAppState,
  setAppState,
  customSystemPrompt,
  appendSystemPrompt,
  thinkingConfig,
  agents,
}: {
  tools: Tools
  commands: Command[]
  mcpClients: MCPServerConnection[]
  messages: Message[]
  readFileState: FileStateCache
  getAppState: () => AppState
  setAppState: (f: (prev: AppState) => AppState) => void
  customSystemPrompt: string | undefined
  appendSystemPrompt: string | undefined
  thinkingConfig: ThinkingConfig | undefined
  agents: AgentDefinition[]
}): Promise<CacheSafeParams> {
  const mainLoopModel = getMainLoopModel()
  const appState = getAppState()

  const { defaultSystemPrompt, userContext, systemContext } =
    await fetchSystemPromptParts({
      tools,
      mainLoopModel,
      additionalWorkingDirectories: Array.from(
        appState.toolPermissionContext.additionalWorkingDirectories.keys(),
      ),
      mcpClients,
      customSystemPrompt,
    })

  const systemPrompt = asSystemPrompt([
    ...(customSystemPrompt !== undefined
      ? [customSystemPrompt]
      : defaultSystemPrompt),
    ...(appendSystemPrompt ? [appendSystemPrompt] : []),
  ])

  // Strip in-progress assistant message (stop_reason === null) — same guard
  // as btw.tsx. The SDK can fire side_question mid-turn.
  const last = messages.at(-1)
  const forkContextMessages =
    last?.type === 'assistant' && last.message.stop_reason === null
      ? messages.slice(0, -1)
      : messages

  const toolUseContext: ToolUseContext = {
    options: {
      commands,
      debug: false,
      mainLoopModel,
      tools,
      verbose: false,
      thinkingConfig:
        thinkingConfig ??
        (shouldEnableThinkingByDefault() !== false
          ? { type: 'adaptive' }
          : { type: 'disabled' }),
      mcpClients,
      mcpResources: {},
      isNonInteractiveSession: true,
      agentDefinitions: { activeAgents: agents, allAgents: [] },
      customSystemPrompt,
      appendSystemPrompt,
    },
    abortController: createAbortController(),
    readFileState,
    getAppState,
    setAppState,
    messages: forkContextMessages,
    setInProgressToolUseIDs: () => {},
    setResponseLength: () => {},
    updateFileHistoryState: () => {},
    updateAttributionState: () => {},
  }

  return {
    systemPrompt,
    userContext,
    systemContext,
    toolUseContext,
    forkContextMessages,
  }
}
