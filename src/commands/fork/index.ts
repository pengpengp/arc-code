import { feature } from 'bun:bundle'
import type { Command } from '../../commands.js'

const fork = {
  type: 'local-jsx',
  name: 'fork',
  description: 'Fork current conversation into a sub-agent',
  // 'fork' is its own command when FORK_SUBAGENT is enabled, so no alias on branch
  argumentHint: '[directive]',
  load: () => feature('FORK_SUBAGENT')
    ? import('./fork.js')
    : Promise.resolve({ call: async () => null } as any),
} satisfies Command

export default fork
