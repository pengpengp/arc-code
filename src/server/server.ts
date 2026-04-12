/**
 * Server — HTTP/WS server for direct-connect mode.
 * Stub for DIRECT_CONNECT flag.
 */

export function startServer(
  config: Record<string, unknown>,
  _sessionManager: unknown,
  _logger: unknown,
): { port: number | undefined } {
  const port = typeof config.port === 'number' ? config.port : undefined
  return { port }
}
