export default {
  name: 'create-workflow',
  description: 'Create a new workflow',
  type: 'local',
  load: async () => {
    return async function createWorkflowCommand() {
      console.log('Workflow creation not available in this build.')
    }
  },
}
