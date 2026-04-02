/**
 * Stub for MONITOR_TOOL feature flag.
 * Monitor MCP servers and services.
 */
export const MonitorTool = {
  name: 'MonitorTool',
  description: 'Monitor services (not available in this build)',
  parameters: { type: 'object', properties: {}, required: [] },
  execute: async () => ({ type: 'text', content: 'MonitorTool not available.' }),
};
