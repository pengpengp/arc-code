/**
 * Server Logger — basic logging for the direct-connect server.
 * Stub for DIRECT_CONNECT flag.
 */

export function createServerLogger(): {
  info: (msg: string) => void
  error: (msg: string) => void
  warn: (msg: string) => void
} {
  return {
    info: (msg: string) => console.log(`[server] ${msg}`),
    error: (msg: string) => console.error(`[server] ${msg}`),
    warn: (msg: string) => console.warn(`[server] ${msg}`),
  }
}
