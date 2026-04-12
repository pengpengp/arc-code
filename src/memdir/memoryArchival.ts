/**
 * Memory-directory archival system.
 *
 * Prevents unbounded growth of memory files by:
 * 1. Archiving old memory files older than TTL into archived.md
 * 2. Distilling daily log files into monthly summaries
 * 3. Monitoring disk usage against a configurable budget
 */

import { existsSync, readdirSync, statSync } from 'fs'
import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
  appendFile,
} from 'fs/promises'
import { basename, dirname, join } from 'path'

const DEFAULT_TTL_DAYS = 7
const DEFAULT_MAX_DISK_BYTES = 100 * 1024 * 1024 // 100MB
const DAILY_LOG_PATTERN = /^\d{4}-\d{2}-\d{2}\.md$/

export interface MemoryStats {
  totalFiles: number
  totalSizeBytes: number
  filesOlderThanTTL: string[]
  dailyLogs: DailyLogInfo[]
}

export interface DailyLogInfo {
  path: string
  date: Date
  sizeBytes: number
}

/**
 * Scan a memory directory and return usage statistics.
 */
export async function scanMemoryDirectory(
  memoryDir: string,
  ttlDays: number = DEFAULT_TTL_DAYS,
): Promise<MemoryStats> {
  if (!existsSync(memoryDir)) {
    return {
      totalFiles: 0,
      totalSizeBytes: 0,
      filesOlderThanTTL: [],
      dailyLogs: [],
    }
  }

  const cutoffMs = Date.now() - ttlDays * 24 * 60 * 60 * 1000
  let totalFiles = 0
  let totalSizeBytes = 0
  const filesOlderThanTTL: string[] = []
  const dailyLogs: DailyLogInfo[] = []

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      if (!entry.name.endsWith('.md')) continue

      totalFiles++
      const s = await stat(fullPath)
      totalSizeBytes += s.size

      if (s.mtimeMs < cutoffMs) {
        filesOlderThanTTL.push(fullPath)
      }

      // Check if this is a daily log file
      if (DAILY_LOG_PATTERN.test(entry.name)) {
        const parts = entry.name.replace('.md', '').split('-')
        if (parts.length === 3) {
          dailyLogs.push({
            path: fullPath,
            date: new Date(
              parseInt(parts[0]!),
              parseInt(parts[1]!) - 1,
              parseInt(parts[2]!),
            ),
            sizeBytes: s.size,
          })
        }
      }
    }
  }

  await walk(memoryDir)

  return {
    totalFiles,
    totalSizeBytes,
    filesOlderThanTTL,
    dailyLogs,
  }
}

/**
 * Archive memory files older than TTL by consolidating them into archived.md.
 */
export async function archiveOldFiles(
  memoryDir: string,
  ttlDays: number = DEFAULT_TTL_DAYS,
): Promise<{ archived: number; sizeFreed: number }> {
  const stats = await scanMemoryDirectory(memoryDir, ttlDays)
  if (stats.filesOlderThanTTL.length === 0) {
    return { archived: 0, sizeFreed: 0 }
  }

  const archivedPath = join(memoryDir, 'archived.md')
  let archived = 0
  let sizeFreed = 0

  // Create archived.md header if it doesn't exist
  if (!existsSync(archivedPath)) {
    await writeFile(
      archivedPath,
      `# Archived Memories\n\nMemories archived on ${new Date().toISOString()}\n\n`,
    )
  }

  for (const filePath of stats.filesOlderThanTTL) {
    try {
      const content = await readFile(filePath, 'utf-8')
      const s = statSync(filePath)

      // Append to archived with filename header
      const filename = basename(filePath)
      const date = new Date(s.mtimeMs).toISOString()
      await appendFile(
        archivedPath,
        `\n---\n## ${filename} (${date})\n\n${content}\n`,
      )

      await rm(filePath)
      archived++
      sizeFreed += s.size
    } catch {
      // Skip files that can't be read/deleted
    }
  }

  return { archived, sizeFreed }
}

/**
 * Distill daily log files into monthly summaries.
 * Logs older than TTL days are consolidated and the originals removed.
 */
export async function distillDailyLogs(
  memoryDir: string,
  ttlDays: number = DEFAULT_TTL_DAYS,
): Promise<{ distilled: number; logsRemoved: number }> {
  const logsDir = join(memoryDir, 'logs')
  if (!existsSync(logsDir)) {
    return { distilled: 0, logsRemoved: 0 }
  }

  const cutoffDate = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000)
  const monthlyLogs = new Map<string, { content: string[]; files: string[] }>()
  let logsRemoved = 0

  // Walk logs/YYYY/MM/YYYY-MM-DD.md
  async function walkLogs(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walkLogs(fullPath)
        continue
      }

      if (!DAILY_LOG_PATTERN.test(entry.name)) continue

      const parts = entry.name.replace('.md', '').split('-')
      if (parts.length !== 3) continue

      const fileDate = new Date(
        parseInt(parts[0]!),
        parseInt(parts[1]!) - 1,
        parseInt(parts[2]!),
      )

      if (fileDate < cutoffDate) {
        try {
          const content = await readFile(fullPath, 'utf-8')
          const monthKey = `${parts[0]}-${parts[1]}`
          if (!monthlyLogs.has(monthKey)) {
            monthlyLogs.set(monthKey, { content: [], files: [] })
          }
          monthlyLogs.get(monthKey)!.content.push(content)
          monthlyLogs.get(monthKey)!.files.push(fullPath)
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  await walkLogs(logsDir)

  // Write monthly summaries and remove originals
  for (const [monthKey, data] of monthlyLogs) {
    const [year, month] = monthKey.split('-')
    const summaryDir = join(logsDir, 'distilled')
    await mkdir(summaryDir, { recursive: true })

    const summaryPath = join(summaryDir, `${year}-${month}.md`)
    const summary = `# Monthly Summary: ${year}-${month}\n\nGenerated: ${new Date().toISOString()}\n\n## Source Logs\n\n${data.content.join('\n\n---\n\n')}\n`

    await writeFile(summaryPath, summary)

    // Remove original daily logs
    for (const filePath of data.files) {
      try {
        await rm(filePath)
        logsRemoved++
      } catch {
        // Skip if removal fails
      }
    }
  }

  // Clean up empty YYYY/MM directories
  await cleanupEmptyLogDirs(logsDir)

  return { distilled: monthlyLogs.size, logsRemoved }
}

/**
 * Remove empty directories in the logs hierarchy.
 */
async function cleanupEmptyLogDirs(logsDir: string): Promise<void> {
  async function cleanup(dir: string): Promise<boolean> {
    const entries = await readdir(dir, { withFileTypes: true })
    let allEmpty = true
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        const childEmpty = await cleanup(fullPath)
        if (childEmpty) {
          try {
            await rm(fullPath)
          } catch {
            allEmpty = false
          }
        } else {
          allEmpty = false
        }
      } else {
        allEmpty = false
      }
    }
    return allEmpty && dir !== logsDir
  }

  try {
    await cleanup(logsDir)
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Check if memory directory exceeds disk budget.
 */
export async function checkDiskUsage(
  memoryDir: string,
  maxBytes: number = DEFAULT_MAX_DISK_BYTES,
): Promise<{ exceeds: boolean; currentSize: number; maxBudget: number }> {
  const stats = await scanMemoryDirectory(memoryDir)
  return {
    exceeds: stats.totalSizeBytes > maxBytes,
    currentSize: stats.totalSizeBytes,
    maxBudget: maxBytes,
  }
}

/**
 * Run full archival cycle: check disk usage, archive old files, distill logs.
 * Called by autoDream during nightly consolidation.
 */
export async function runMemoryArchival(
  memoryDir: string,
  ttlDays: number = DEFAULT_TTL_DAYS,
  maxBytes: number = DEFAULT_MAX_DISK_BYTES,
): Promise<{
  diskCheck: { exceeds: boolean; currentSize: number; maxBudget: number }
  archived: { archived: number; sizeFreed: number }
  distilled: { distilled: number; logsRemoved: number }
}> {
  const diskCheck = await checkDiskUsage(memoryDir, maxBytes)

  // Always distill logs (lightweight operation)
  const distilled = await distillDailyLogs(memoryDir, ttlDays)

  // Archive old files only if disk usage is high or TTL exceeded
  let archived = { archived: 0, sizeFreed: 0 }
  if (diskCheck.exceeds) {
    archived = await archiveOldFiles(memoryDir, ttlDays)
  }

  return { diskCheck, archived, distilled }
}
