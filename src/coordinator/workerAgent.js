/**
 * COORDINATOR Mode - Multi-agent orchestration.
 * Provides coordinator agents that delegate work to specialized workers.
 * The coordinator manages task distribution, monitors progress,
 * and consolidates results from multiple parallel agents.
 */
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/growthbook.js'
import { logForDebugging } from '../utils/debug.js'

/**
 * Get coordinator agent definitions
 * Returns an array of agent definitions for the coordinator mode
 */
export function getCoordinatorAgents() {
  return [
    {
      agentType: 'coordinator',
      name: 'Coordinator',
      description: 'Orchestrates work across multiple agents',
      whenToUse: 'When you need to manage multiple parallel tasks or delegate complex work',
      source: 'built-in',
      baseDir: 'built-in',
      tools: ['Bash', 'Read', 'Edit', 'Agent', 'TaskOutput', 'SendMessage'],
      skills: [],
      model: 'sonnet',
      background: true,
      getSystemPrompt: ({ toolUseContext }) => {
        return `You are the Coordinator agent in Claude Code's coordinator mode.

Your role is to:
1. Break down complex tasks into sub-tasks
2. Delegate sub-tasks to specialized worker agents using the Agent tool
3. Monitor worker progress and handle failures
4. Consolidate results from multiple workers
5. Report status to the user

When delegating:
- Be specific about the task and expected output
- Provide necessary context (file paths, constraints, existing patterns)
- Set clear success criteria
- Use the TaskOutput tool to check on worker progress

Available worker types:
- explore: For researching code patterns and finding files
- implement: For writing and modifying code
- test: For running and fixing tests
- review: For code review and quality checks`
      },
    },
    {
      agentType: 'worker-explore',
      name: 'Explore Worker',
      description: 'Researches code patterns and finds files',
      whenToUse: 'When you need to understand existing code or find specific patterns',
      source: 'built-in',
      baseDir: 'built-in',
      tools: ['Bash', 'Read', 'Grep', 'Glob', 'Agent'],
      skills: [],
      model: 'haiku',
      background: true,
      getSystemPrompt: ({ toolUseContext }) => {
        return `You are an Explore Worker agent in coordinator mode.

Your role is to:
1. Search the codebase for specific patterns, files, or implementations
2. Read and understand existing code
3. Report findings back to the coordinator

Be thorough but efficient. Focus on answering the specific question asked.`
      },
    },
    {
      agentType: 'worker-implement',
      name: 'Implement Worker',
      description: 'Writes and modifies code',
      whenToUse: 'When you need to implement a specific feature or fix',
      source: 'built-in',
      baseDir: 'built-in',
      tools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Agent'],
      skills: [],
      model: 'sonnet',
      background: true,
      getSystemPrompt: ({ toolUseContext }) => {
        return `You are an Implement Worker agent in coordinator mode.

Your role is to:
1. Write code according to the task specification
2. Follow existing codebase patterns and conventions
3. Run tests to verify your changes
4. Report progress and any issues encountered

Match the existing code style. Make minimal, focused changes.`
      },
    },
  ]
}

/**
 * Check if coordinator mode is available
 */
export function isCoordinatorAvailable() {
  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_coordinator', false)
}

/**
 * Get coordinator status
 */
export function getCoordinatorStatus() {
  return {
    available: isCoordinatorAvailable(),
    agents: getCoordinatorAgents().map(a => ({
      type: a.agentType,
      name: a.name,
      model: a.model,
      background: a.background,
    })),
  }
}
