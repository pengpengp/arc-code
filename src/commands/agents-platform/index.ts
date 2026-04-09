export default {
  name: 'agents-platform',
  description: 'Agents platform command',
  type: 'local',
  load: async () => { return async function agentsPlatformCommand() { console.log('Agents platform not available.'); } },
};
