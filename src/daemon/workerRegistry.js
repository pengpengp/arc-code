/**
 * Daemon Worker Registry - Manages worker processes for the daemon.
 */
import { logForDebugging } from '../utils/debug.js'

const WORKER_HANDLERS = new Map()

export function registerWorkerHandler(type, handler) {
  WORKER_HANDLERS.set(type, handler)
}

export async function runDaemonWorker(workerType) {
  const handler = WORKER_HANDLERS.get(workerType)
  if (!handler) {
    console.error('Unknown worker type: ' + workerType)
    process.exit(1)
  }
  logForDebugging('Starting daemon worker: ' + workerType)
  try {
    await handler()
  } catch (err) {
    console.error('Worker ' + workerType + ' failed: ' + err.message)
    process.exit(1)
  }
}

export function getWorkerTypes() {
  return [...WORKER_HANDLERS.keys()]
}

registerWorkerHandler('supervisor', async () => {
  logForDebugging('Supervisor worker started')
})

registerWorkerHandler('assistant', async () => {
  logForDebugging('Assistant worker started')
})

registerWorkerHandler('task', async () => {
  logForDebugging('Task worker started')
})
