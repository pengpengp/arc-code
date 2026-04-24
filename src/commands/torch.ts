/**
 * Torch command — advanced debugging and diagnostics.
 * Used by TORCH feature flag.
 *
 * Provides deep introspection: process state, memory analysis,
 * module loading, event loop diagnostics, and state dumps.
 */

import { join } from 'path'
import { writeFileSync, mkdirSync } from 'fs'
import { getClaudeConfigHomeDir } from '../utils/envUtils.js'

export default {
  name: 'torch',
  description: 'Torch diagnostics — debugging and introspection utilities',
  type: 'local',
  load: async () => {
    return async function torchCommand(args: string[]) {
      const sub = args[0] || 'info'

      switch (sub) {
        case 'info':
          printProcessInfo()
          break
        case 'memory':
          printMemoryInfo()
          break
        case 'env':
          printEnvInfo()
          break
        case 'dump': {
          const path = await dumpState(args[1])
          console.log(`State dumped to: ${path}`)
          break
        }
        case 'modules':
          printLoadedModules()
          break
        case 'timers':
          printActiveHandles()
          break
        default:
          console.log(`Unknown torch subcommand: ${sub}`)
          console.log('Usage: claude torch [info|memory|env|dump|modules|timers]')
      }
    }
  },
}

function printProcessInfo() {
  console.log('=== Process Info ===')
  console.log(`  Node/Bun: ${process.version}`)
  console.log(`  Platform: ${process.platform} ${process.arch}`)
  console.log(`  PID: ${process.pid}`)
  console.log(`  Uptime: ${Math.round(process.uptime())}s`)
  console.log(`  CWD: ${process.cwd()}`)
  console.log(`  Memory: ${formatBytes(process.memoryUsage().heapUsed)} / ${formatBytes(process.memoryUsage().heapTotal)}`)
}

function printMemoryInfo() {
  const mem = process.memoryUsage()
  console.log('=== Memory Usage ===')
  console.log(`  RSS:            ${formatBytes(mem.rss)}`)
  console.log(`  Heap Total:     ${formatBytes(mem.heapTotal)}`)
  console.log(`  Heap Used:      ${formatBytes(mem.heapUsed)}`)
  console.log(`  External:       ${formatBytes(mem.external)}`)
  console.log(`  Array Buffers:  ${formatBytes((mem as any).arrayBuffers ?? 0)}`)
  console.log(`  Heap Utilization: ${((mem.heapUsed / mem.heapTotal) * 100).toFixed(1)}%`)

  if (typeof (globalThis as any).gc === 'function') {
    console.log('\n  Running GC...')
    ;(globalThis as any).gc()
    const after = process.memoryUsage()
    console.log(`  Heap after GC:  ${formatBytes(after.heapUsed)}`)
    console.log(`  Freed:          ${formatBytes(mem.heapUsed - after.heapUsed)}`)
  }
}

function printEnvInfo() {
  const sensitive = ['ANTHROPIC_API_KEY', 'API_KEY', 'SECRET', 'TOKEN', 'PASSWORD']
  console.log('=== Environment ===')
  console.log(`  CLAUDE_CODE_MODE: ${process.env.CLAUDE_CODE_MODE || 'not set'}`)
  console.log(`  CLAUDE_CODE_CLI: ${process.env.CLAUDE_CODE_CLI || 'not set'}`)
  console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`)
  console.log(`  TERM: ${process.env.TERM || 'not set'}`)
  console.log(`  SHELL: ${process.env.SHELL || 'not set'}`)

  const hasSensitive = sensitive.filter(k => process.env[k])
  if (hasSensitive.length > 0) {
    console.log(`  Sensitive env vars found: ${hasSensitive.length}`)
  }
  console.log(`  Total env vars: ${Object.keys(process.env).length}`)
}

async function dumpState(filename?: string): Promise<string> {
  const dir = join(getClaudeConfigHomeDir(), 'torch-dumps')
  mkdirSync(dir, { recursive: true })
  const name = filename || `torch-${Date.now()}.json`
  const path = join(dir, name)

  const state = {
    timestamp: new Date().toISOString(),
    process: {
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptime: process.uptime(),
      cwd: process.cwd(),
    },
    memory: process.memoryUsage(),
    env: Object.fromEntries(
      Object.entries(process.env).filter(([k]) => !k.includes('KEY') && !k.includes('SECRET') && !k.includes('TOKEN'))
    ),
  }

  writeFileSync(path, JSON.stringify(state, null, 2))
  return path
}

function printLoadedModules() {
  console.log('=== Module Cache ===')
  const modules = Object.keys(require.cache || {})
  console.log(`  Loaded modules: ${modules.length}`)
  // Show top modules by path prefix
  const prefixes: Record<string, number> = {}
  for (const m of modules) {
    const prefix = m.split(/[/\\]/).slice(0, -1).join('/')
    const short = prefix.length > 60 ? '...' + prefix.slice(-57) : prefix
    prefixes[short] = (prefixes[short] || 0) + 1
  }
  const sorted = Object.entries(prefixes).sort((a, b) => b[1] - a[1]).slice(0, 15)
  for (const [path, count] of sorted) {
    console.log(`  ${path}/ (${count} modules)`)
  }
}

function printActiveHandles() {
  console.log('=== Active Handles ===')
  // Best effort — _getActiveHandles may not exist in all runtimes
  const handles = (process as any)._getActiveHandles?.() ?? []
  const requests = (process as any)._getActiveRequests?.() ?? []
  console.log(`  Active handles: ${handles.length}`)
  console.log(`  Active requests: ${requests.length}`)

  if (handles.length > 0) {
    const types: Record<string, number> = {}
    for (const h of handles) {
      const type = h.constructor?.name || 'unknown'
      types[type] = (types[type] || 0) + 1
    }
    for (const [type, count] of Object.entries(types).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type}: ${count}`)
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
