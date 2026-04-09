export default {
  name: 'torch',
  description: 'Torch command - advanced debugging and diagnostics',
  type: 'local',
  load: async () => {
    return async function torchCommand(args) {
      console.log('Torch diagnostics:')
      console.log('  Node:', process.version)
      console.log('  Platform:', process.platform)
      console.log('  Memory:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024), 'MB')
    }
  },
}
