import { generateTaskId } from '../../Task.js'

export const LocalWorkflowTask = {
  name: 'Local Workflow',
  type: 'local_workflow',
  async kill(taskId, setAppState) {
    setAppState(prev => {
      const tasks = { ...prev.tasks }
      const task = tasks[taskId]
      if (task) {
        tasks[taskId] = { ...task, status: 'killed' }
      }
      return { ...prev, tasks }
    })
  },
}

export function spawnLocalWorkflowTask(workflowName, setAppState) {
  const taskId = generateTaskId('local_workflow')
  const taskState = {
    id: taskId,
    type: 'local_workflow',
    status: 'running',
    label: `Workflow: ${workflowName}`,
    workflowName,
    startedAt: new Date().toISOString(),
    isBackgrounded: true,
  }
  setAppState(prev => ({
    ...prev,
    tasks: { ...prev.tasks, [taskId]: taskState },
  }))
  return taskId
}

export function killWorkflowTask(taskId, setAppState) {
  setAppState(prev => {
    const tasks = { ...prev.tasks }
    const task = tasks[taskId]
    if (task && task.type === 'local_workflow') {
      tasks[taskId] = { ...task, status: 'killed', completedAt: new Date().toISOString() }
    }
    return { ...prev, tasks }
  })
}

export function skipWorkflowAgent(taskId, agentId, setAppState) {}
export function retryWorkflowAgent(taskId, agentId, setAppState) {}
