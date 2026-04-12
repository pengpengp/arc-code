/**
 * Session Manager — manages API sessions for the direct-connect server.
 * Stub for DIRECT_CONNECT flag.
 */

export class SessionManager {
  private _backend: unknown
  private _options: { idleTimeoutMs: number; maxSessions: number }

  constructor(
    backend: unknown,
    options: { idleTimeoutMs: number; maxSessions: number },
  ) {
    this._backend = backend
    this._options = options
  }
}
