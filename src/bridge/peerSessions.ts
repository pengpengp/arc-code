/**
 * Peer Sessions — bridge for inter-Claude-Code-session messaging.
 * Stub implementation for UDS_INBOX / BRIDGE_MODE feature flags.
 *
 * Full implementation would manage peer session discovery, registration,
 * and message routing via Unix domain sockets or bridge connections.
 */

export interface PeerSession {
  id: string
  name?: string
  pid?: number
  socketPath?: string
  bridgePath?: string
}

export async function postInterClaudeMessage(
  target: string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  // Stub: no actual peer routing in dev builds
  return { ok: true }
}

export function getActivePeers(): PeerSession[] {
  return []
}

export function registerPeerSession(session: PeerSession): void {
  // Stub
}

export function unregisterPeerSession(id: string): void {
  // Stub
}
