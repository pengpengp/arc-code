/**
 * DAEMON Mode - Persistent background Claude Code instance.
 * Runs as a long-lived process that can accept connections from
 * multiple clients (CLI, IDE, web). Manages worker processes
 * for concurrent task execution.
 */
import { spawn, fork } from 'child_process'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { createServer } from 'net'
import { getClaudeConfigHomeDir } from '../utils/envUtils.js'
import { logForDebugging } from '../utils/debug.js'

const DAEMON_DIR = join(getClaudeConfigHomeDir(), 'daemon')
const DAEMON_SOCKET = join(tmpdir(), 'claude-daemon.sock')
const DAEMON_PID_FILE = join(DAEMON_DIR, 'daemon.pid')
const WORKER_REGISTRY_FILE = join(DAEMON_DIR, 'workers.json')

/**
 * Main daemon entry point
 */
export async function daemonMain(args) {
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
async function startDaemon(args) {
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
async function spawnWorker(type, config) {
  const id = `worker_${randomUUID().slice(0, 8)}`
  const daemonPath = join(process.cwd(), process.argv[1])

  const child = fork(daemonPath, ['--daemon-worker', type], {
    detached: false,
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, CLAUDE_WORKER_ID: id, CLAUDE_WORKER_TYPE: type },
  })

  // Register worker
  registerWorker(id, type, child.pid)

  child.on('exit', (code) => {
    unregisterWorker(id)
    logForDebugging(`Worker ${id} exited with code ${code}`)
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
function registerWorker(id, type, pid) {
  const workers = loadWorkers()
  workers.push({ id, type, pid, status: 'running', startedAt: new Date().toISOString() })
  saveWorkers(workers)
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
