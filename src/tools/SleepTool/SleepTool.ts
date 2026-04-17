import { z } from 'zod/v4';
import { lazySchema } from '../../utils/lazySchema.js';

const inputSchema = lazySchema(() => z.object({ duration: z.number() }));

export const SleepTool = {
  name: 'sleep',
  description: 'Wait for a specified duration',
  get inputSchema() { return inputSchema(); },
  isEnabled: () => true,
  prompt: async () => 'Wait for a specified duration',
  execute: async (params) => { await new Promise(r => setTimeout(r, params.duration * 1000)); return { type: 'text', content: 'Slept.' }; },
};
