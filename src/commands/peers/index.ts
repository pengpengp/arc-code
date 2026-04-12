import type { Command } from '../../commands.js'

const peers = {
  type: 'local',
  name: 'peers',
  description: 'List other Claude Code sessions on this machine (UDS peers)',
  load: async () => {
    const { ListPeersTool } = await import('../../tools/ListPeersTool/ListPeersTool.js')
    return {
      default: async function peersCommand(): Promise<void> {
        const result = await ListPeersTool.execute()
        console.log(result)
      },
    }
  },
} satisfies Command

export default peers
