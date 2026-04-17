import { z } from 'zod/v4';
import { lazySchema } from '../../utils/lazySchema.js';

const inputSchema = lazySchema(() => z.object({}).passthrough());

export const REPLTool = {
  name: 'repl',
  description: 'REPL tool',
  get inputSchema() { return inputSchema(); },
  prompt: async () => 'REPL tool',
  execute: async () => ({ type: 'text', content: 'REPLTool not available.' }),
};
