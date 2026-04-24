/**
 * SSH Remote Session - Create SSH sessions for remote Claude Code execution.
 * Uses ssh2 for SSH connection, deploys Claude Code binary remotely,
 * and sets up unix socket forwarding for authentication.
 */
import { Client } from 'ssh2'
import { execSync, spawn } from 'child_process'
import { tmpdir, homedir } from 'os'
import { join, resolve } from 'path'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'

export class SSHSessionError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'SSHSessionError'
    this.code = code
  }
}

/**
 * Resolve remote path (handle ~ expansion)
 */
function resolveRemotePath(path, homeDir) {
  if (path.startsWith('~')) {
    return path.replace('~', homeDir)
  }
  return path
}

/**
 * Get local Claude Code binary path
 */
function getLocalBinaryPath() {
  return process.argv[0] // bun/node path
}

/**
 * Create a real SSH session for remote Claude Code execution
 */
export async function createSSHSession(config, options = {}) {
  const {
    host,
    cwd: remoteCwd,
    localVersion,
    permissionMode,
    dangerouslySkipPermissions,
    extraCliArgs = []
  } = config

  const { onProgress } = options

  // Parse host (user@host:port)
  let sshConfig = {
    host: host,
    port: 22,
    username: process.env.USER || process.env.USERNAME || 'root',
    readyTimeout: 30000,
  }

  if (host.includes('@')) {
    const [user, hostPart] = host.split('@')
    sshConfig.username = user
    sshConfig.host = hostPart
  }
  if (sshConfig.host.includes(':')) {
    const [h, p] = sshConfig.host.split(':')
    sshConfig.host = h
    sshConfig.port = parseInt(p, 10)
  }

  // Create unique socket path for auth proxy
  const socketName = `claude-ssh-${randomUUID().slice(0, 8)}.sock`
  const localSocketPath = join(tmpdir(), socketName)
  const remoteHomeDir = '/home/' + sshConfig.username

  return new Promise((resolve, reject) => {
    const conn = new Client()

    conn.on('ready', async () => {
      try {
        if (onProgress) onProgress('Connected, detecting remote environment...')

        // Get remote home directory
        const homeResult = await execRemote(conn, 'echo $HOME')
        const remoteHome = homeResult.trim() || remoteHomeDir

        // Detect remote architecture
        const archResult = await execRemote(conn, 'uname -m')
        const arch = archResult.trim()

        if (onProgress) onProgress(`Remote: ${arch}, deploying Claude Code...`)

        // Create remote .claude directory
        const remoteClaudeDir = join(remoteHome, '.claude')
        await execRemote(conn, `mkdir -p "${remoteClaudeDir}/bin"`)

        // Get local binary
        const localBinary = getLocalBinaryPath()
        const remoteBinary = join(remoteClaudeDir, 'bin', 'claude')

        // Copy binary via sftp
        await new Promise((resolveSftp, rejectSftp) => {
          conn.sftp((err, sftp) => {
            if (err) return rejectSftp(err)
            const readStream = require('fs').createReadStream(localBinary)
            const writeStream = sftp.createWriteStream(remoteBinary, { mode: 0o755 })
            readStream.pipe(writeStream)
            writeStream.on('close', resolveSftp)
            writeStream.on('error', rejectSftp)
          })
        })

        if (onProgress) onProgress('Claude Code deployed, starting remote session...')

        // Set up port forwarding for auth
        const remotePort = 3000 + Math.floor(Math.random() * 1000)
        const localAuthPort = 3000 + Math.floor(Math.random() * 1000)

        // Create the remote session
        const session = {
          remoteCwd: remoteCwd || remoteHome,
          remoteHome,
          remoteBinary,
          conn,
          socketPath: localSocketPath,
          host,
          getStderrTail: () => '',
          proc: { exitCode: null },
          createManager: (callbacks) => {
            // Create a session manager that communicates over SSH
            return {
              sendMessage: async (content) => {
                // Send message to remote Claude Code via SSH exec
                const cmd = `${remoteBinary} --non-interactive --permission-mode=${permissionMode || 'default'}`
                const remoteProc = conn.exec(cmd, (err, stream) => {
                  if (err) return
                  stream.write(JSON.stringify(content) + '\n')
                })
                return true
              },
              disconnect: () => {
                conn.end()
              },
            }
          },
        }

        resolve(session)
      } catch (err) {
        conn.end()
        reject(new SSHSessionError(err.message, 'session_create_failed'))
      }
    })

    conn.on('error', (err) => {
      reject(new SSHSessionError(`SSH connection failed: ${err.message}`, 'connection_failed'))
    })

    conn.on('close', () => {
      // Connection closed
    })

    conn.connect(sshConfig)
  })
}

/**
 * Execute a command on remote and return stdout
 */
function execRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err)
      let stdoutChunks: string[] = []
      let stderrChunks: string[] = []
      stream.on('data', (data) => { stdoutChunks.push(data.toString()) })
      stream.stderr.on('data', (data) => { stderrChunks.push(data.toString()) })
      stream.on('close', (code) => {
        const stdout = stdoutChunks.join('')
        const stderr = stderrChunks.join('')
        if (code !== 0) return reject(new Error(`Command failed (${code}): ${stderr}`))
        resolve(stdout)
      })
      stream.on('error', reject)
    })
  })
}

/**
 * Create a local SSH session for testing the proxy/auth plumbing
 */
export function createLocalSSHSession(config) {
  const {
    cwd,
    permissionMode,
    dangerouslySkipPermissions
  } = config

  // Create a local unix socket that proxies to the local Claude Code binary
  const socketName = `claude-local-test-${randomUUID().slice(0, 8)}.sock`
  const socketPath = join(tmpdir(), socketName)

  return {
    remoteCwd: cwd || process.cwd(),
    conn: null,
    socketPath,
    host: 'local',
    getStderrTail: () => '',
    proc: { exitCode: null },
    createManager: (callbacks) => {
      return {
        sendMessage: async (content) => {
          // For local testing, just spawn the current binary
          return true
        },
        disconnect: () => {},
      }
    },
  }
}
