import type { LocalJSXCommandContext } from '../../commands.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { feature } from 'bun:bundle'
import { isForkSubagentEnabled } from '../../tools/AgentTool/forkSubagent.js'

/**
 * Fork command — splits the current conversation into a sub-agent.
 *
 * When FORK_SUBAGENT is enabled, this injects a directive message into the
 * conversation that triggers the model to spawn a fork agent via the Agent tool.
 *
 * Usage:
 *   /fork "implement the auth middleware"
 *   /fork "analyze the test coverage in src/utils/"
 */
export async function call(
  _onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  args: string,
): Promise<React.ReactNode> {
  const directive = args?.trim()

  if (!directive) {
    _onDone(
      'Usage: /fork <directive>\n\nProvide a short directive for the forked sub-agent to execute.\nExample: /fork "write unit tests for src/utils/fileReadCache.ts"',
    )
    return null
  }

  if (!feature('FORK_SUBAGENT')) {
    _onDone(
      'The /fork command is not available in this build. Enable the FORK_SUBAGENT feature flag.',
    )
    return null
  }

  if (!isForkSubagentEnabled()) {
    _onDone(
      'Fork is currently unavailable. It cannot be used in coordinator mode or non-interactive sessions.',
    )
    return null
  }

  // Inject a system message that instructs the model to spawn a fork agent.
  // The model will see this directive and use the Agent tool with the
  // fork mechanism (implicit subagent_type omission triggers fork path).
  context.setMessages(prev => [
    ...prev,
    {
      type: 'user' as const,
      message: {
        content: [
          {
            type: 'text' as const,
            text: `[FORK DIRECTIVE] Please spawn a fork sub-agent with the following directive: "${directive}"\n\nUse the Agent tool WITHOUT specifying a subagent_type — this triggers the implicit fork path. Pass this exact directive in the prompt parameter.`,
          },
        ],
      },
    },
  ])

  _onDone(`Fork directive queued: "${directive}"`)
  return null
}
