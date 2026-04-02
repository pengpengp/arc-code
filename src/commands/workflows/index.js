import { readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'

const WORKFLOWS_DIR = join(getClaudeConfigHomeDir(), 'workflows')

export default {
  name: 'workflows',
  description: 'Manage and run automated workflows',
  type: 'local',
  load: async () => {
    return async function workflowsCommand(args) {
      const subcommand = args[0]
      if (!subcommand || subcommand === 'list') {
        if (!existsSync(WORKFLOWS_DIR)) {
          console.log('No workflows configured. Create workflows in ~/.claude/workflows/')
          return
        }
        const files = readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.md') || f.endsWith('.yaml') || f.endsWith('.yml'))
        if (files.length === 0) {
          console.log('No workflows found.')
          return
        }
        console.log('Available workflows:')
        for (const f of files) {
          console.log(`  - ${f}`)
        }
      } else if (subcommand === 'run') {
        const name = args[1]
        if (!name) {
          console.log('Usage: claude workflows run <name>')
          return
        }
        console.log(`Running workflow: ${name}`)
      } else {
        console.log(`Unknown workflow command: ${subcommand}`)
        console.log('Usage: claude workflows [list|run <name>]')
      }
    }
  },
}
