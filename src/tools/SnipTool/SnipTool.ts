/**
 * SnipTool — compact conversation history.
 * Stub for HISTORY_SNIP flag.
 */

export const SnipTool = {
  name: 'Snip',
  description: 'Compact conversation history',
  parameters: {
    type: 'object' as const,
    properties: {},
    required: [] as string[],
  },
  execute: async (): Promise<string> => {
    return 'Snip tool is not available in this build.'
  },
}
