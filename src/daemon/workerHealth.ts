/**
 * Daemon Worker Health Monitoring.
 *
 * Tracks worker heartbeat timestamps and runs periodic health checks.
 * Workers that miss heartbeats are considered crashed and can be restarted.
 */

import { logForDebugging } from '../utils/debug.js'
import { logError } from '../utils/log.js'

/** Heartbeat interval: workers should ping every 10s */
export const HEARTBEAT_INTERVAL_MS = 10_000

/** Missed heartbeats before marking unhealthy (3 = 30s) */
export const MAX_MISSED_HEARTBEATS = 3

/** Health check polling interval: every 30s */
export const HEALTH_CHECK_INTERVAL_MS = 30_000

interface WorkerHeartbeat {
  lastHeartbeat: number
  missCount: number
}

const heartbeatMap = new Map<string, WorkerHeartbeat>()

/**
 * Record a heartbeat from a worker.
 * Call this when the worker sends a heartbeat message via IPC.
 */
export function recordHeartbeat(workerId: string): void {
  const existing = heartbeatMap.get(workerId)
  if (existing) {
    existing.lastHeartbeat = Date.now()
    existing.missCount = 0
  } else {
    heartbeatMap.set(workerId, {
      lastHeartbeat: Date.now(),
      missCount: 0,
    })
  }
}

/**
 * Remove a worker from heartbeat tracking.
 * Call when a worker is stopped or removed.
 */
export function removeHeartbeat(workerId: string): void {
  heartbeatMap.delete(workerId)
}

/**
 * Get heartbeat info for a worker.
 * Returns undefined if not tracked.
 */
export function getHeartbeatInfo(workerId: string): WorkerHeartbeat | undefined {
  return heartbeatMap.get(workerId)
}

/**
 * Check all tracked workers for health.
 * Returns a list of workers that have exceeded the missed heartbeat threshold.
 */
export function checkAllWorkersHealth(): Array<{
  workerId: string
  lastHeartbeat: number
  secondsSinceLastBeat: number
  missCount: number
}> {
  const now = Date.now()
  const unhealthy: Array<{
    workerId: string
    lastHeartbeat: number
    secondsSinceLastBeat: number
    missCount: number
  }> = []

  for (const [workerId, beat] of heartbeatMap) {
    const elapsed = now - beat.lastHeartbeat
    const missed = Math.floor(elapsed / HEARTBEAT_INTERVAL_MS)

    if (missed > MAX_MISSED_HEARTBEATS) {
      unhealthy.push({
        workerId,
        lastHeartbeat: beat.lastHeartbeat,
        secondsSinceLastBeat: Math.round(elapsed / 1000),
        missCount: beat.missCount + 1,
      })
      beat.missCount++
    }
  }

  return unhealthy
}

/**
 * Start the periodic health check loop.
 * Calls `onUnhealthy` for each worker that exceeds the missed heartbeat threshold.
 * The caller is responsible for restarting or taking other action.
 *
 * @returns A function that stops the health check when called.
 */
export function startHealthCheck(
  getWorkerPids: () => Map<string, number | undefined>,
  onUnhealthy: (workerId: string, info: { secondsSinceLastBeat: number }) => void,
): () => void {
  logForDebugging('[worker-health] Starting health check loop')

  const interval = setInterval(() => {
    const unhealthy = checkAllWorkersHealth()
    for (const info of unhealthy) {
      // Verify process is actually dead via PID check
      const pids = getWorkerPids()
      const pid = pids.get(info.workerId)
      if (pid != null) {
        try {
          process.kill(pid, 0)
          // Process alive but not sending heartbeats — still unhealthy
          logForDebugging(
            `[worker-health] Worker ${info.workerId} (PID ${pid}) alive but no heartbeat (${info.secondsSinceLastBeat}s)`,
          )
        } catch {
          // Process is truly dead
          logForDebugging(
            `[worker-health] Worker ${info.workerId} (PID ${pid}) confirmed dead`,
          )
        }
      }
      onUnhealthy(info.workerId, { secondsSinceLastBeat: info.secondsSinceLastBeat })
    }
  }, HEALTH_CHECK_INTERVAL_MS)

  // Don't block process exit
  if (interval.unref) {
    interval.unref()
  }

  return () => {
    clearInterval(interval)
    logForDebugging('[worker-health] Stopped health check loop')
  }
}
