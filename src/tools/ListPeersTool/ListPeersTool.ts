/**
 * ListPeersTool — discover active local Claude Code peers via UDS.
 *
 * Lists other Claude Code sessions running on the same machine that have
 * UDS messaging enabled. Used by SendMessageTool to discover cross-session
 * messaging targets.
 */

import { readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

import { z } from 'zod/v4';
import { lazySchema } from '../../utils/lazySchema.js';

const inputSchema = lazySchema(() => z.object({}).passthrough());

export const ListPeersTool = {
  name: 'ListPeers',
  description: 'List other Claude Code sessions on this machine',
  get inputSchema() { return inputSchema(); },
  prompt: async () => 'List other Claude Code sessions on this machine',
  execute: async (): Promise<string> => {
    const socksDir = process.env.CLAUDE_CODE_SOCKS_DIR || join(homedir(), '.claude', 'socks')
    if (!existsSync(socksDir)) {
      return 'No other Claude Code sessions found on this machine.'
    }

    const files = readdirSync(socksDir).filter(f => f.startsWith('cc-') && f.endsWith('.sock'))
    if (files.length === 0) {
      return 'No other Claude Code sessions found on this machine.'
    }

    const lines = files.map(f => {
      const pid = f.replace('cc-', '').replace('.sock', '')
      return `- Session PID: ${pid} (socket: ${f})`
    })

    return `Active Claude Code sessions:\n${lines.join('\n')}`
  },
}
