export const REPLTool = {
  name: 'repl',
  description: 'REPL tool',
  parameters: { type: 'object', properties: {}, required: [] },
  execute: async () => ({ type: 'text', content: 'REPLTool not available.' }),
};
