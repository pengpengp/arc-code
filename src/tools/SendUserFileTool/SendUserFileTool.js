export const SendUserFileTool = {
  name: 'send_user_file',
  description: 'Send a file to the user',
  parameters: { type: 'object', properties: {}, required: [] },
  execute: async () => ({ type: 'text', content: 'SendUserFileTool not available.' }),
};
