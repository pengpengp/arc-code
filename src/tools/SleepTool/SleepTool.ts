export const SleepTool = {
  name: 'sleep',
  description: 'Wait for a specified duration',
  parameters: { type: 'object', properties: { duration: { type: 'number' } }, required: ['duration'] },
  execute: async (params) => { await new Promise(r => setTimeout(r, params.duration * 1000)); return { type: 'text', content: 'Slept.' }; },
};
