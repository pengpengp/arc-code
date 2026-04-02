/**
 * Stub for KAIROS_PUSH_NOTIFICATION feature flag.
 * Send push notifications from Claude Code.
 */
export const PushNotificationTool = {
  name: 'PushNotificationTool',
  description: 'Send push notifications (not available in this build)',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (params, context) => {
    return { type: 'text', content: 'PushNotificationTool not available in this build.' };
  },
};
