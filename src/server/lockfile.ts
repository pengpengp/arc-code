/**
 * Server Lockfile — prevent multiple server instances on the same port.
 * Stub for DIRECT_CONNECT flag.
 */

export interface ServerLock {
  pid: number
  port: number
  host: string
  httpUrl: string
  startedAt: number
}

export async function writeServerLock(_lock: ServerLock): Promise<void> {
  // Stub
}

export async function removeServerLock(): Promise<void> {
  // Stub
}

export async function probeRunningServer(): Promise<ServerLock | null> {
  // Stub: no existing server
  return null
}
