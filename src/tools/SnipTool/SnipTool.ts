/**
 * SnipTool — compact conversation history.
 * Stub for HISTORY_SNIP flag.
 */

import { z } from 'zod/v4';
import { lazySchema } from '../../utils/lazySchema.js';

const inputSchema = lazySchema(() => z.object({}).passthrough());

export const SnipTool = {
  name: 'Snip',
  description: 'Compact conversation history',
  get inputSchema() { return inputSchema(); },
  prompt: async () => 'Compact conversation history',
  execute: async (): Promise<string> => {
    return 'Snip tool is not available in this build.'
  },
}
