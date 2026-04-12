/**
 * Connect Headless — headless CLI mode for direct-connect sessions.
 * Used by `claude connect <cc://url> --print` to run headlessly.
 *
 * Stub implementation for DIRECT_CONNECT feature flag.
 */

export async function runConnectHeadless(
  _config: Record<string, unknown>,
  prompt: string,
  _outputFormat?: string,
  _interactive?: boolean,
): Promise<void> {
  // Stub: no actual headless connect in this build.
  // Full implementation would bootstrap a headless REPL and stream output.
  if (prompt) {
    console.error('Headless connect is not available in this build.')
  }
}
