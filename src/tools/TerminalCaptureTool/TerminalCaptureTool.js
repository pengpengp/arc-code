/**
 * Stub for TERMINAL_PANEL feature flag.
 * Capture terminal output for analysis.
 */
export const TerminalCaptureTool = {
  name: 'TerminalCaptureTool',
  description: 'Capture terminal output (not available)',
  parameters: { type: 'object', properties: {}, required: [] },
  execute: async () => ({ type: 'text', content: 'TerminalCaptureTool not available.' }),
};
