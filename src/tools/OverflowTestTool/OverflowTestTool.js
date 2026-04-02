/**
 * Stub for OVERFLOW_TEST_TOOL feature flag.
 * Testing tool for context overflow behavior.
 */
export const OverflowTestTool = {
  name: 'OverflowTestTool',
  description: 'Test context overflow behavior (not available in this build)',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (params, context) => {
    return { type: 'text', content: 'OverflowTestTool not available in this build.' };
  },
};
