import { z } from 'zod/v4';
import { lazySchema } from '../../utils/lazySchema.js';

const inputSchema = lazySchema(() => z.object({}).passthrough());

export const SendUserFileTool = {
  name: 'send_user_file',
  description: 'Send a file to the user',
  get inputSchema() { return inputSchema(); },
  isEnabled: () => true,
  prompt: async () => 'Send a file to the user',
  execute: async () => ({ type: 'text', content: 'SendUserFileTool not available.' }),
};
