import { join } from 'path'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'

const BUDDY_DIR = join(getClaudeConfigHomeDir(), 'buddy')

export default {
  name: 'buddy',
  description: 'Buddy companion - your AI companion for casual conversation',
  type: 'local',
  load: async () => {
    return async function buddyCommand(args) {
      console.log('Buddy mode: casual AI companion conversation')
      console.log('Buddy directory:', BUDDY_DIR)
    }
  },
}
