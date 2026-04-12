/**
 * Server Banner — display server connection info on startup.
 * Stub for DIRECT_CONNECT flag.
 */

export function printBanner(
  config: { host: string; port?: number; unix?: string },
  authToken: string,
  actualPort: number,
): void {
  const url = config.unix
    ? `unix:${config.unix}`
    : `http://${config.host}:${actualPort}`
  console.log(`Server started at ${url}`)
}
