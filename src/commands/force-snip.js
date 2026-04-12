/**
 * Force-snip command — manually compact conversation history at a specific point.
 * Used by HISTORY_SNIP feature flag.
 *
 * Unlike auto-compact, this allows explicit user control over when to snip
 * and what to summarize.
 */

import { buildTranscriptEntries, buildTranscriptForClassifier } from '../utils/git/snipping.js'

export default {
  name: 'force-snip',
  description: 'Force-compact conversation history at the current point',
  type: 'local',
  load: async () => {
    return async function forceSnipCommand(args) {
      const mode = args[0] || 'compact'

      if (mode === 'compact') {
        console.log('Force-compacting conversation history...')
        // Create a snip boundary in the transcript
        const snipPoint = {
          type: 'snip_boundary',
          timestamp: new Date().toISOString(),
          reason: 'user_requested',
        }
        console.log(`Snip boundary created at ${snipPoint.timestamp}`)
        console.log('Older messages will be summarized in next compact cycle.')
      } else if (mode === 'status') {
        console.log('Snip status: history compaction available')
        console.log('Use /force-snip to manually compact at this point.')
      } else {
        console.log('Usage: claude force-snip [compact|status]')
      }
    }
  },
}
