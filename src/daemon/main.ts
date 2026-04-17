/**
 * DAEMON Mode - Persistent background Claude Code instance.
 * Runs as a long-lived process that can accept connections from
 * multiple clients (CLI, IDE, web). Manages worker processes
 * for concurrent task execution.
 */
import { spawn, fork, type ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { createServer } from 'net'
import { getClaudeConfigHomeDir } from '../utils/envUtils.js'
import { logForDebugging } from '../utils/debug.js'
import {
  recordHeartbeat,
  removeHeartbeat,
  startHealthCheck,
  HEALTH_CHECK_INTERVAL_MS,
} from './workerHealth.js'

const DAEMON_DIR = join(getClaudeConfigHomeDir(), 'daemon')
const DAEMON_SOCKET = join(tmpdir(), 'claude-daemon.sock')
const DAEMON_PID_FILE = join(DAEMON_DIR, 'daemon.pid')
const WORKER_REGISTRY_FILE = join(DAEMON_DIR, 'workers.json')

/**
 * Main daemon entry point
 */
export async function daemonMain(args: string[]): Promise<void> {
  const command = args[0] || 'start'

  switch (command) {
    case 'start':
      return startDaemon(args.slice(1))
    case 'stop':
      return stopDaemon()
    case 'status':
      return daemonStatus()
    case 'restart':
      await stopDaemon()
      return startDaemon(args.slice(1))
    default:
      console.error(`Unknown daemon command: ${command}`)
      console.log('Usage: claude daemon [start|stop|status|restart]')
      process.exit(1)
  }
}

/**
 * Start the daemon
 */
async function startDaemon(args: string[]): Promise<void> {
  // Atomic PID file check-and-create to prevent race conditions
  // If file exists but process is dead, clean up and proceed
  if (existsSync(DAEMON_PID_FILE)) {
    try {
      const pid = parseInt(readFileSync(DAEMON_PID_FILE, 'utf-8').trim(), 10)
      process.kill(pid, 0)
      // Process is alive — daemon is running
      console.log('Daemon is already running.')
      return
    } catch {
      // Stale PID file — process is dead, clean up
      logForDebugging(`[daemon] Stale PID file detected, cleaning up`)
      try {
        require('fs').unlinkSync(DAEMON_PID_FILE)
      } catch {
        // Ignore — may have been cleaned up by another process
      }
    }
  }

  // Check if already running
  if (isDaemonRunning()) {
    console.log('Daemon is already running.')
    return
  }

  // Ensure daemon directory
  if (!existsSync(DAEMON_DIR)) {
    mkdirSync(DAEMON_DIR, { recursive: true })
  }

  console.log('Starting Claude Code daemon...')

  // Fork a child process as the daemon
  const daemonPath = join(process.cwd(), process.argv[1])
  const childArgs = ['--daemon-worker', 'supervisor']

  const child = fork(daemonPath, childArgs, {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, CLAUDE_DAEMON: '1' },
  })

  child.unref()

  // Write PID file
  writeFileSync(DAEMON_PID_FILE, String(child.pid))

  console.log(`Daemon started (PID: ${child.pid})`)
  console.log(`Socket: ${DAEMON_SOCKET}`)
}

/**
 * Stop the daemon
 */
async function stopDaemon() {
  if (!isDaemonRunning()) {
    console.log('Daemon is not running.')
    return
  }

  const pid = parseInt(readFileSync(DAEMON_PID_FILE, 'utf-8').trim(), 10)
  try {
    process.kill(pid, 'SIGTERM')
    console.log(`Daemon stopped (PID: ${pid})`)
  } catch (err) {
    console.log(`Daemon process not found, cleaning up.`)
  }

  try {
    require('fs').unlinkSync(DAEMON_PID_FILE)
  } catch {
    // PID file already removed
  }
}

/**
 * Check daemon status
 */
async function daemonStatus() {
  if (isDaemonRunning()) {
    const pid = readFileSync(DAEMON_PID_FILE, 'utf-8').trim()
    console.log(`Daemon is running (PID: ${pid})`)

    // Show worker info
    if (existsSync(WORKER_REGISTRY_FILE)) {
      const workers = JSON.parse(readFileSync(WORKER_REGISTRY_FILE, 'utf-8'))
      console.log(`Active workers: ${workers.length}`)
      for (const w of workers) {
        console.log(`  - ${w.type}: ${w.status} (PID: ${w.pid})`)
      }
    }
  } else {
    console.log('Daemon is not running.')
  }
}

/**
 * Check if daemon is running
 */
function isDaemonRunning() {
  if (!existsSync(DAEMON_PID_FILE)) return false
  try {
    const pid = parseInt(readFileSync(DAEMON_PID_FILE, 'utf-8').trim(), 10)
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Create Unix socket server for client connections
 */
function createDaemonSocketServer() {
  return createServer((socket) => {
    let buffer = ''
    socket.on('data', (data) => {
      buffer += data.toString()
      try {
        const message = JSON.parse(buffer)
        handleDaemonMessage(socket, message)
        buffer = ''
      } catch {
        // Incomplete message, wait for more data
      }
    })
  })
}

/**
 * Handle daemon messages
 */
function handleDaemonMessage(socket, message) {
  switch (message.type) {
    case 'ping':
      socket.write(JSON.stringify({ type: 'pong' }) + '\n')
      break
    case 'spawn_worker':
      spawnWorker(message.workerType, message.config)
        .then(id => socket.write(JSON.stringify({ type: 'worker_spawned', id }) + '\n'))
        .catch(err => socket.write(JSON.stringify({ type: 'error', message: err.message }) + '\n'))
      break
    case 'kill_worker':
      killWorker(message.id)
        .then(() => socket.write(JSON.stringify({ type: 'worker_killed' }) + '\n'))
        .catch(err => socket.write(JSON.stringify({ type: 'error', message: err.message }) + '\n'))
      break
    case 'list_workers':
      listWorkers()
        .then(workers => socket.write(JSON.stringify({ type: 'workers', workers }) + '\n'))
        .catch(err => socket.write(JSON.stringify({ type: 'error', message: err.message }) + '\n'))
      break
    default:
      socket.write(JSON.stringify({ type: 'error', message: `Unknown message type: ${message.type}` }) + '\n')
  }
}

/**
 * Spawn a worker process
 */
/**
 * Spawn a worker process
 */
const MAX_RESTARTS_PER_WORKER = 5
/**
 * Delay before auto-restart to allow system resources to stabilize.
 */
const RESTART_DELAY_MS = 1000

/** Map of worker ID to child process for PID lookups */
const activeWorkers = new Map<string, ChildProcess>()

/** Lazy-start health check loop — starts on first worker spawn */
let healthCheckStopper: (() => void) | null = null

function ensureHealthCheckRunning(): void {
  if (healthCheckStopper) return
  healthCheckStopper = startHealthCheck(
    () => {
      const pids = new Map<string, number | undefined>()
      for (const [id, proc] of activeWorkers) {
        pids.set(id, proc.pid)
      }
      return pids
    },
    (workerId, info) => {
      // Worker unhealthy — check if process is dead and restart
      const proc = activeWorkers.get(workerId)
      if (proc && proc.pid) {
        try {
          process.kill(proc.pid, 0)
        } catch {
          // Process confirmed dead, trigger restart
          logForDebugging(
            `[daemon] Health check: worker ${workerId} dead, forcing restart`,
          )
          const workers = loadWorkers()
          const w = workers.find(w => w.id === workerId)
          const restartCount = w?.restartCount ?? 0
          if (restartCount < MAX_RESTARTS_PER_WORKER) {
            activeWorkers.delete(workerId)
            removeHeartbeat(workerId)
            unregisterWorker(workerId)
            spawnWorker(w?.type ?? 'task').catch(err => {
              logForDebugging(`[daemon] Health check restart failed: ${err.message}`)
            })
          }
        }
      }
    },
  )
}

async function spawnWorker(type: string, config: Record<string, unknown> = {}): Promise<string> {
  // Start health check loop on first worker
  ensureHealthCheckRunning()

  const id = `worker_${randomUUID().slice(0, 8)}`
  const daemonPath = join(process.cwd(), process.argv[1])

  const child = fork(daemonPath, ['--daemon-worker', type], {
    detached: false,
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, CLAUDE_WORKER_ID: id, CLAUDE_WORKER_TYPE: type },
  })

  activeWorkers.set(id, child)
  recordHeartbeat(id)

  // Listen for heartbeat messages from workers
  child.on('message', (msg: unknown) => {
    if (msg && typeof msg === 'object' && (msg as { type?: string }).type === 'heartbeat') {
      recordHeartbeat(id)
    }
  })

  // Register worker with restart count tracking
  registerWorker(id, type, child.pid, 0)

  child.on('exit', (code) => {
    activeWorkers.delete(id)
    removeHeartbeat(id)
    const workers = loadWorkers()
    const worker = workers.find(w => w.id === id)
    const restartCount = worker?.restartCount ?? 0
    unregisterWorker(id)
    logForDebugging(`Worker ${id} exited with code ${code}`)

    // Auto-restart on unexpected exit (code !== 0 and code !== null)
    // with max restart limit to prevent infinite loops
    if (code !== 0 && code !== null && restartCount < MAX_RESTARTS_PER_WORKER) {
      logForDebugging(`[daemon] Worker ${id} crashed (exit code ${code}), attempting auto-restart (${restartCount + 1}/${MAX_RESTARTS_PER_WORKER})`)
      setTimeout(() => {
        spawnWorker(type, config).catch(err => {
          logForDebugging(`[daemon] Auto-restart failed for ${id}: ${err.message}`)
        })
      }, RESTART_DELAY_MS)
    } else if (restartCount >= MAX_RESTARTS_PER_WORKER) {
      logForDebugging(`[daemon] Worker ${id} exceeded max restarts (${MAX_RESTARTS_PER_WORKER}), not restarting`)
    }
  })

  return id
}

/**
 * Kill a worker
 */
async function killWorker(id) {
  const workers = loadWorkers()
  const worker = workers.find(w => w.id === id)
  if (worker && worker.pid) {
    process.kill(worker.pid, 'SIGTERM')
  }
  unregisterWorker(id)
}

/**
 * List workers
 */
async function listWorkers() {
  return loadWorkers()
}

/**
 * Register a worker
 */
function registerWorker(id, type, pid, restartCount = 0) {
  const workers = loadWorkers()
  workers.push({ id, type, pid, status: 'running', startedAt: new Date().toISOString(), restartCount })
  saveWorkers(workers)

  // Prune old stopped workers to prevent unbounded growth
  pruneStoppedWorkers()
}

/**
 * Prune stopped workers older than 7 days from workers.json.
 * Also verifies that "running" workers are actually alive — marks dead
 * ones as stopped so they get pruned and are eligible for restart.
 */
function pruneStoppedWorkers() {
  const CUTOFF_DAYS = 7
  const cutoffMs = Date.now() - CUTOFF_DAYS * 24 * 60 * 60 * 1000
  const workers = loadWorkers()
  let changed = false

  const pruned = workers.filter(w => {
    if (w.status === 'running') {
      // Verify the process is actually still alive
      if (w.pid) {
        try {
          process.kill(w.pid, 0)
          return true // Still alive
        } catch {
          // Process is dead — mark as stopped
          logForDebugging(`[daemon] Worker ${w.id} (PID ${w.pid}) is dead, marking as stopped`)
          w.status = 'stopped'
          w.stoppedAt = new Date().toISOString()
          changed = true
          // Keep it so the 7-day prune can clean it up
          return true
        }
      }
      return true
    }
    if (!w.stoppedAt) return false
    return new Date(w.stoppedAt).getTime() > cutoffMs
  })

  if (pruned.length !== workers.length) {
    saveWorkers(pruned)
    logForDebugging(`[daemon] Pruned ${workers.length - pruned.length} stale worker entries`)
  } else if (changed) {
    saveWorkers(workers)
  }
}

/**
 * Unregister a worker
 */
function unregisterWorker(id) {
  const workers = loadWorkers()
  const idx = workers.findIndex(w => w.id === id)
  if (idx >= 0) {
    workers[idx].status = 'stopped'
    workers[idx].stoppedAt = new Date().toISOString()
    saveWorkers(workers)
  }
}

/**
 * Load workers from disk
 */
function loadWorkers() {
  try {
    if (existsSync(WORKER_REGISTRY_FILE)) {
      return JSON.parse(readFileSync(WORKER_REGISTRY_FILE, 'utf-8'))
    }
  } catch {
    // Ignore
  }
  return []
}

/**
 * Save workers to disk
 */
function saveWorkers(workers) {
  try {
    if (!existsSync(DAEMON_DIR)) {
      mkdirSync(DAEMON_DIR, { recursive: true })
    }
    writeFileSync(WORKER_REGISTRY_FILE, JSON.stringify(workers, null, 2))
  } catch {
    // Ignore
  }
}
