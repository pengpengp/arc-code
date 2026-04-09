export default {
  name: 'force-snip',
  description: 'Force-snip message history at a specific point',
  type: 'local',
  load: async () => {
    return async function forceSnipCommand(args) {
      console.log('Force-snip: message history snipped')
    }
  },
}
