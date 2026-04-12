import type { Command } from './commands.js'

const subscribePr = {
  type: 'local',
  name: 'subscribe-pr',
  description: 'Subscribe to GitHub PR notifications',
  argumentHint: '<repo/pr-number>',
  load: async () => {
    return {
      default: async function subscribePrCommand(args?: string): Promise<void> {
        console.log('Subscribe PR is not fully configured in this build.')
      },
    }
  },
} satisfies Command

export default subscribePr
