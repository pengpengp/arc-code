/**
 * Stub for KAIROS_GITHUB_WEBHOOKS feature flag.
 * Subscribe to GitHub PR webhooks for real-time notifications.
 */
export const SubscribePRTool = {
  name: 'SubscribePRTool',
  description: 'Subscribe to GitHub PR webhooks (not available in this build)',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (params, context) => {
    return { type: 'text', content: 'SubscribePRTool not available in this build.' };
  },
};
