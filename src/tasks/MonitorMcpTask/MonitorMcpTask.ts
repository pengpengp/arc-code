/**
 * MonitorMcpTask - Background task for monitoring MCP server health.
 * Runs as a periodic task that checks MCP server connectivity
 * and reports status to the background tasks panel.
 */
import type { Task, SetAppState, TaskContext } from '../../Task.js'
import { generateTaskId } from '../../Task.js'
import type { AppState } from '../../state/AppState.js'
import { logForDebugging } from '../../utils/debug.js'

export type MonitorMcpTaskState = {
  id: string
  type: 'monitor_mcp'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'killed'
  label: string
  target: string
  interval: number
  startedAt?: string
  completedAt?: string
  lastCheck?: string
  lastStatus?: string
  lastLatency?: number
  checkCount: number
  errorCount: number
  isBackgrounded: boolean
}

const ACTIVE_MONITORS = new Map<string, ReturnType<typeof setInterval>>()

/**
 * Kill a monitor MCP task
 */
export function killMonitorMcp(taskId: string, setAppState: SetAppState): void {
  const timerId = ACTIVE_MONITORS.get(taskId)
  if (timerId) {
    clearInterval(timerId)
    ACTIVE_MONITORS.delete(taskId)
  }

  setAppState((prev: AppState) => {
    const tasks = { ...prev.tasks }
    const task = tasks[taskId]
    if (task && task.type === 'monitor_mcp') {
      tasks[taskId] = {
        ...task,
        status: 'killed' as const,
        completedAt: new Date().toISOString(),
      }
    }
    return { ...prev, tasks }
  })

  logForDebugging(`Monitor MCP task killed: ${taskId}`)
}

/**
 * Kill all monitor MCP tasks for a specific agent
 */
export function killMonitorMcpTasksForAgent(
  agentId: string,
  getAppState: () => AppState,
  setAppState: SetAppState,
): void {
  const state = getAppState()
  for (const [taskId, task] of Object.entries(state.tasks)) {
    if (
      task.type === 'monitor_mcp' &&
      task.status === 'running' &&
      (task as MonitorMcpTaskState).target.includes(agentId)
    ) {
      killMonitorMcp(taskId, setAppState)
    }
  }
}

/**
 * Check MCP server health
 */
async function checkMcpHealth(serverName: string): Promise<{ status: string; latency: number; error?: string }> {
  const start = Date.now()
  try {
    // Basic connectivity check - in a real implementation this would
    // ping the MCP server via its protocol
    return { status: 'ok', latency: Date.now() - start }
  } catch (err: any) {
    return { status: 'error', latency: Date.now() - start, error: err.message }
  }
}

/**
 * Start monitoring an MCP server
 */
function startMonitor(
  taskId: string,
  target: string,
  interval: number,
  setAppState: SetAppState,
): void {
  let checkCount = 0
  let errorCount = 0

  const timerId = setInterval(async () => {
    const result = await checkMcpHealth(target)
    checkCount++
    if (result.status === 'error') errorCount++

    setAppState((prev: AppState) => {
      const tasks = { ...prev.tasks }
      const task = tasks[taskId]
      if (task && task.type === 'monitor_mcp') {
        tasks[taskId] = {
          ...task,
          lastCheck: new Date().toISOString(),
          lastStatus: result.status,
          lastLatency: result.latency,
          checkCount,
          errorCount,
        }
      }
      return { ...prev, tasks }
    })
  }, interval * 1000)

  ACTIVE_MONITORS.set(taskId, timerId)
}

export const MonitorMcpTask: Task = {
  name: 'Monitor MCP',
  type: 'monitor_mcp',

  async kill(taskId: string, setAppState: SetAppState): Promise<void> {
    killMonitorMcp(taskId, setAppState)
  },
}

/**
 * Spawn a new monitor MCP task
 */
export function spawnMonitorMcpTask(
  target: string,
  interval: number = 30,
  setAppState: SetAppState,
): string {
  const taskId = generateTaskId('monitor_mcp')

  const taskState: MonitorMcpTaskState = {
    id: taskId,
    type: 'monitor_mcp',
    status: 'running',
    label: `Monitor: ${target}`,
    target,
    interval,
    startedAt: new Date().toISOString(),
    checkCount: 0,
    errorCount: 0,
    isBackgrounded: true,
  }

  setAppState((prev: AppState) => ({
    ...prev,
    tasks: {
      ...prev.tasks,
      [taskId]: taskState,
    },
  }))

  startMonitor(taskId, target, interval, setAppState)
  logForDebugging(`Monitor MCP task spawned: ${taskId} for ${target} every ${interval}s`)

  return taskId
}
