/**
 * KAIROS Assistant Command Entry Point
 */
export default {
  name: 'assistant',
  description: 'Open persistent AI assistant mode',
  type: 'local',
  load: async () => {
    return async function assistantCommand() {
      // Handled by main.tsx routing
    }
  },
}
