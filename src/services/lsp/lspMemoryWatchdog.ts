/**
 * LSP server memory monitoring.
 *
 * Polls RSS of LSP child processes and triggers warnings/restarts
 * when memory thresholds are exceeded. Prevents unbounded memory growth
 * as seen in competitor Windsurf's language server leak (60GB RSS).
 *
 * Cross-platform: uses `tasklist` (Windows), `ps` (macOS/Linux).
 */

import { execSync } from 'child_process'
import { logForDebugging } from '../../utils/debug.js'
import { logError } from '../../utils/log.js'

/** Warning threshold: 500MB RSS */
export const LSP_RSS_WARNING_MB = 500

/** Restart threshold: 1GB RSS */
export const LSP_RSS_RESTART_MB = 1024

/** Polling interval: 60 seconds */
export const LSP_MEMORY_POLL_INTERVAL_MS = 60_000

/**
 * Get RSS memory (in MB) of a process by PID.
 * Returns null if process doesn't exist or can't be queried.
 * Cross-platform: Windows uses tasklist, Unix uses ps.
 */
export function getProcessRSS(pid: number): number | null {
  try {
    if (process.platform === 'win32') {
      // tasklist /FI "PID eq <pid>" /FO CSV
      // Output: "Image Name","PID","Session Name","Session#","Mem Usage"
      const output = execSync(
        `tasklist /FI "PID eq ${pid}" /FO CSV /NH 2>NUL`,
        { encoding: 'utf-8', timeout: 5000 },
      )
      const match = output.match(/"(\d+)"\s*(?:,\s*"[^"]*")*\s*,\s*"([\d,]+)\s*K"/)
      if (match) {
        const memKB = parseInt(match[2]!.replace(/,/g, ''), 10)
        return Math.round(memKB / 1024)
      }
      return null
    }

    // macOS/Linux: ps -o rss= -p <pid>
    const output = execSync(
      `ps -o rss= -p ${pid} 2>/dev/null`,
      { encoding: 'utf-8', timeout: 5000 },
    )
    const rssKB = parseInt(output.trim(), 10)
    if (isNaN(rssKB)) return null
    return Math.round(rssKB / 1024)
  } catch {
    // Process doesn't exist, permission denied, or command unavailable
    return null
  }
}

let watchdogInterval: ReturnType<typeof setInterval> | null = null
const watchedServers = new Map<
  string,
  { getPid: () => number | undefined; restart: () => Promise<void> }
>()

/**
 * Register an LSP server for memory monitoring.
 */
export function watchLSPServer(
  name: string,
  getPid: () => number | undefined,
  restart: () => Promise<void>,
): void {
  watchedServers.set(name, { getPid, restart })
}

/**
 * Unregister an LSP server from memory monitoring.
 */
export function unwatchLSPServer(name: string): void {
  watchedServers.delete(name)
}

/**
 * Start the periodic memory watchdog.
 */
export function startMemoryWatchdog(): void {
  if (watchdogInterval) return
  logForDebugging('[lsp-memory] Starting memory watchdog')

  watchdogInterval = setInterval(() => {
    for (const [name, server] of watchedServers) {
      checkServerMemory(name, server)
    }
  }, LSP_MEMORY_POLL_INTERVAL_MS)

  // Don't block process exit
  if (watchdogInterval.unref) {
    watchdogInterval.unref()
  }
}

/**
 * Stop the memory watchdog.
 */
export function stopMemoryWatchdog(): void {
  if (watchdogInterval) {
    clearInterval(watchdogInterval)
    watchdogInterval = null
    logForDebugging('[lsp-memory] Stopped memory watchdog')
  }
}

/**
 * Check a single server's memory usage.
 */
async function checkServerMemory(
  name: string,
  server: { getPid: () => number | undefined; restart: () => Promise<void> },
): Promise<void> {
  const pid = server.getPid()
  if (pid == null) return

  const rssMB = getProcessRSS(pid)
  if (rssMB == null) return

  if (rssMB >= LSP_RSS_RESTART_MB) {
    logError(
      new Error(
        `LSP server "${name}" (PID ${pid}) RSS: ${rssMB}MB — exceeds ${LSP_RSS_RESTART_MB}MB restart threshold. Triggering restart.`,
      ),
    )
    try {
      await server.restart()
      logForDebugging(`[lsp-memory] Restarted "${name}" after exceeding RSS threshold`)
    } catch (e) {
      logError(new Error(`Failed to restart LSP server "${name}": ${(e as Error).message}`))
    }
  } else if (rssMB >= LSP_RSS_WARNING_MB) {
    logForDebugging(
      `[lsp-memory] LSP server "${name}" (PID ${pid}) RSS: ${rssMB}MB — exceeds ${LSP_RSS_WARNING_MB}MB warning threshold`,
    )
  }
}
