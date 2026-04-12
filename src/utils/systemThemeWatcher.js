/**
 * System theme watcher — monitors terminal OSC 11 responses for dark/light detection.
 * Used by AUTO_THEME feature flag for real-time theme switching.
 *
 * Watches the terminal's background color response and notifies listeners
 * when the system theme changes between dark and light modes.
 */

import { themeFromOscColor, setCachedSystemTheme } from './systemTheme.js'

export function watchSystemTheme(
  internal_querier: (osc: string) => Promise<string | null>,
  setSystemTheme: (theme: string) => void,
): () => void {
  let cancelled = false

  async function pollTheme() {
    if (cancelled) return
    try {
      const oscResponse = await internal_querier('11')
      if (oscResponse) {
        const theme = themeFromOscColor(oscResponse)
        if (theme) {
          setCachedSystemTheme(theme)
          setSystemTheme(theme)
        }
      }
    } catch {
      // Terminal doesn't support OSC 11 — poll fallback
    }
    // Poll periodically since terminals don't push OSC updates
    if (!cancelled) {
      setTimeout(pollTheme, 5000)
    }
  }

  void pollTheme()

  return () => {
    cancelled = true
  }
}
