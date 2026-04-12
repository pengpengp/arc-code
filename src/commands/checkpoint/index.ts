import type { Command } from '../../commands.js'

const savepoint = {
  type: 'local',
  name: 'savepoint',
  description: 'Create, list, or restore named code checkpoints',
  argumentHint: '<create|list|rollback|delete> [name]',
  load: () => import('./savepoint.js'),
} satisfies Command

export default savepoint
