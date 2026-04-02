/**
 * Stub for PROACTIVE feature flag.
 * Proactive mode command entry point.
 */
export default {
  name: 'proactive',
  description: 'Proactive mode (not available in this build)',
  type: 'local',
  load: async () => {
    return async function proactiveCommand() {
      console.log('Proactive mode not available in this build.');
    };
  },
};
