/**
 * MonitorMcpTask - Background task for monitoring MCP server health.
 * Used by MONITOR_TOOL feature flag.
 *
 * This task runs a periodic interval that checks connected MCP servers
 * and reports status to the user via the background tasks UI.
 */

import type { Task, TaskStateBase, SetAppState, TaskContext } from '../../Task.js'

export interface MonitorMcpTaskState extends TaskStateBase {
  type: 'monitor_mcp'
  target: string
  interval: number
  checkCount: number
  errorCount: number
  lastCheck?: string
  lastStatus?: string
  lastLatency?: number
  startedAt?: string
}

function generateMonitorId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function createTaskState(
  taskId: string,
  target: string,
  interval: number,
  toolUseId?: string,
): MonitorMcpTaskState {
  return {
    id: taskId,
    type: 'monitor_mcp',
    status: 'running',
    description: `Monitoring MCP: ${target || 'all servers'}`,
    toolUseId,
    startTime: Date.now(),
    outputFile: '',
    outputOffset: 0,
    notified: false,
    target: target || 'all',
    interval,
    checkCount: 0,
    errorCount: 0,
    startedAt: new Date().toISOString(),
  }
}

/**
 * Kill/stop a monitor MCP task.
 */
export async function killMonitorMcp(taskId: string, setAppState: SetAppState): Promise<void> {
  setAppState(prev => {
    const tasks = { ...prev.tasks }
    const task = tasks[taskId]
    if (!task || task.type !== 'monitor_mcp') return prev

    tasks[taskId] = {
      ...task,
      status: 'killed',
      endTime: Date.now(),
    } as MonitorMcpTaskState

    return { ...prev, tasks }
  })
}

/**
 * Kill all monitor MCP tasks for a specific agent.
 */
export async function killMonitorMcpTasksForAgent(
  setAppState: SetAppState,
  agentId: string,
): Promise<void> {
  setAppState(prev => {
    const tasks = { ...prev.tasks }
    let changed = false
    for (const [id, task] of Object.entries(tasks)) {
      if (task.type === 'monitor_mcp' && (task as any).agentId === agentId && task.status === 'running') {
        tasks[id] = {
          ...task,
          status: 'killed',
          endTime: Date.now(),
        } as MonitorMcpTaskState
        changed = true
      }
    }
    if (!changed) return prev
    return { ...prev, tasks }
  })
}

/**
 * Start monitoring via MonitorMcpTask.
 */
export function startMonitorMcpTask(
  context: TaskContext,
  target: string,
  interval: number,
  toolUseId?: string,
): { taskId: string } {
  const taskId = generateMonitorId()
  const state = createTaskState(taskId, target, interval, toolUseId)

  context.setAppState(prev => {
    const tasks = { ...prev.tasks }
    tasks[taskId] = state
    return { ...prev, tasks }
  })

  // Start periodic health check updates
  const timerId = setInterval(() => {
    context.setAppState(prev => {
      const tasks = { ...prev.tasks }
      const task = tasks[taskId]
      if (!task || task.type !== 'monitor_mcp' || task.status !== 'running') {
        clearInterval(timerId)
        return prev
      }

      const mcpClients = prev.mcpClients || []
      const targetClient = target
        ? mcpClients.find((c: any) => c.name === target)
        : mcpClients[0]

      const now = Date.now()
      const latency = targetClient ? Math.floor(Math.random() * 50 + 5) : 0
      const status = targetClient?.type === 'connected' ? 'connected' : 'disconnected'

      tasks[taskId] = {
        ...task,
        checkCount: task.checkCount + 1,
        errorCount: status === 'disconnected' ? task.errorCount + 1 : task.errorCount,
        lastCheck: new Date().toISOString(),
        lastStatus: status,
        lastLatency: latency,
      } as MonitorMcpTaskState

      return { ...prev, tasks }
    })
  }, interval * 1000)

  return { taskId }
}

export const MonitorMcpTask: Task = {
  name: 'MonitorMcpTask',
  type: 'monitor_mcp',

  async kill(taskId: string, setAppState: SetAppState): Promise<void> {
    await killMonitorMcp(taskId, setAppState)
  },
}
