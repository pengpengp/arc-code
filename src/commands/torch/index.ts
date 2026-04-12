import type { Command } from '../../commands.js'

const torch = {
  type: 'local',
  name: 'torch',
  description: 'Torch mode — development/debugging helper',
  load: async () => {
    return {
      default: async function torchCommand(): Promise<void> {
        console.log('Torch mode is a stub in this build.')
      },
    }
  },
} satisfies Command

export default torch
