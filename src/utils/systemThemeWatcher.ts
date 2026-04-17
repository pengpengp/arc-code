import { logForDebugging } from './debug.js'
import { isStdinTTY, isStdoutTTY } from './isTTY.js'

export function watchSystemTheme(internal_querier, setSystemTheme) {
  if (!isStdinTTY() || !isStdoutTTY()) return () => {}
  let cancelled = false
  let pollTimer = null
  let buffer = ''
  const ESC = String.fromCharCode(27)
  const ESC_BS = ESC + '\\'

  function queryTheme() {
    if (cancelled) return
    try { process.stdout.write(ESC + ']11;?' + ESC_BS) } catch (e) { logForDebugging(`[theme-watcher] stdout write failed: ${e}`) }
  }

  function onData(data) {
    if (cancelled) return
    buffer += data.toString()
    const oscMatch = buffer.match(/\x1b\]11;([^\x07\x1b]+)(?:\x1b\\|\x07)/)
    if (oscMatch) {
      const theme = themeFromOscColor(oscMatch[1])
      if (theme) { setCachedSystemTheme(theme); setSystemTheme(theme) }
      buffer = ''
    }
    if (buffer.length > 1024) buffer = buffer.slice(-512)
  }

  process.stdin.on('data', onData)
  queryTheme()
  pollTimer = setInterval(() => { if (!cancelled) queryTheme() }, 30000)

  return () => {
    cancelled = true
    process.stdin.removeListener('data', onData)
    if (pollTimer) clearInterval(pollTimer)
  }
}
