import { z } from 'zod/v4';
import { lazySchema } from '../../utils/lazySchema.js';

const inputSchema = lazySchema(() => z.object({}).passthrough());

export const SuggestBackgroundPRTool = {
  name: 'suggest_background_pr',
  description: 'Suggest a background PR',
  get inputSchema() { return inputSchema(); },
  prompt: async () => 'Suggest a background PR',
  execute: async () => ({ type: 'text', content: 'SuggestBackgroundPRTool not available.' }),
};
