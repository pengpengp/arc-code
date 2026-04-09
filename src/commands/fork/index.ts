export default {
  name: 'fork',
  description: 'Fork current conversation into a sub-agent',
  type: 'local',
  load: async () => {
    return async function forkCommand(args) {
      console.log('Fork: conversation forked to sub-agent')
    }
  },
}
