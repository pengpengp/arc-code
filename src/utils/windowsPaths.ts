import memoize from 'lodash-es/memoize.js'
import * as path from 'path'
import * as pathWin32 from 'path/win32'
import { getCwd } from './cwd.js'
import { logForDebugging } from './debug.js'
import { execSync_DEPRECATED } from './execSyncWrapper.js'
import { memoizeWithLRU } from './memoize.js'
import { getPlatform } from './platform.js'

/**
 * Check if a file or directory exists on Windows using the dir command
 * @param path - The path to check
 * @returns true if the path exists, false otherwise
 */
function checkPathExists(p: string): boolean {
  try {
    execSync_DEPRECATED(`dir "${p}"`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * Find an executable using where.exe on Windows
 * @param executable - The name of the executable to find
 * @returns The path to the executable or null if not found
 */
function findExecutable(executable: string): string | null {
  // For git, check common installation locations first
  if (executable === 'git') {
    const defaultLocations = [
      // check 64 bit before 32 bit
      'C:\\Program Files\\Git\\cmd\\git.exe',
      'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
      // intentionally don't look for C:\Program Files\Git\mingw64\bin\git.exe
      // because that directory is the "raw" tools with no environment setup
    ]

    for (const location of defaultLocations) {
      if (checkPathExists(location)) {
        return location
      }
    }
  }

  // Fall back to where.exe
  try {
    const result = execSync_DEPRECATED(`where.exe ${executable}`, {
      stdio: 'pipe',
      encoding: 'utf8',
    }).trim()

    // SECURITY: Filter out any results from the current directory
    // to prevent executing malicious git.bat/cmd/exe files
    const paths = result.split('\r\n').filter(Boolean)
    const cwd = getCwd().toLowerCase()

    for (const candidatePath of paths) {
      // Normalize and compare paths to ensure we're not in current directory
      const normalizedPath = path.resolve(candidatePath).toLowerCase()
      const pathDir = path.dirname(normalizedPath).toLowerCase()

      // Skip if the executable is in the current working directory
      if (pathDir === cwd || normalizedPath.startsWith(cwd + path.sep)) {
        logForDebugging(
          `Skipping potentially malicious executable in current directory: ${candidatePath}`,
        )
        continue
      }

      // Return the first valid path that's not in the current directory
      return candidatePath
    }

    return null
  } catch {
    return null
  }
}

/**
 * If Windows, set the SHELL environment variable to git-bash path.
 * This is used by BashTool and Shell.ts for user shell commands.
 * COMSPEC is left unchanged for system process execution.
 */
export function setShellIfWindows(): void {
  if (getPlatform() === 'windows') {
    const gitBashPath = findGitBashPath()
    process.env.SHELL = gitBashPath
    logForDebugging(`Using bash path: "${gitBashPath}"`)
  }
}

/**
 * Find the path where `bash.exe` included with git-bash exists, exiting the process if not found.
 */
export const findGitBashPath = memoize((): string => {
  // 1. Explicit env var override
  if (process.env.CLAUDE_CODE_GIT_BASH_PATH) {
    if (checkPathExists(process.env.CLAUDE_CODE_GIT_BASH_PATH)) {
      return process.env.CLAUDE_CODE_GIT_BASH_PATH
    }
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.error(
      `Claude Code was unable to find CLAUDE_CODE_GIT_BASH_PATH path "${process.env.CLAUDE_CODE_GIT_BASH_PATH}"`,
    )
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(1)
  }

  // 2. If already running inside bash, use the current bash binary
  if (process.env.BASH) {
    // BASH may be a POSIX path like /usr/bin/bash in MSYS2 environments.
    // On Windows, fs.statSync can't resolve POSIX paths directly, so just
    // trust the env var when it looks like a valid bash path.
    if (process.env.BASH.endsWith('bash.exe') || process.env.BASH.endsWith('bash')) {
      return process.env.BASH
    }
    if (checkPathExists(process.env.BASH)) {
      return process.env.BASH
    }
  }

  // 3. Search PATH for bash.exe
  const pathEnv = process.env.PATH || ''
  const pathDirs = pathWin32.delimiter === ';'
    ? pathEnv.split(';').filter(Boolean)
    : pathEnv.split(':').filter(Boolean)
  for (const dir of pathDirs) {
    const candidate = pathWin32.join(dir, 'bash.exe')
    if (checkPathExists(candidate)) {
      return candidate
    }
    // Also try converting from POSIX-style directory (MSYS2 PATH may
    // contain /usr/bin style entries). On Windows, fs.statSync can't
    // resolve POSIX paths, so convert to Windows path first.
    if (dir.startsWith('/') && dir.length >= 3) {
      // /c/... or /usr/bin style
      const driveMatch = dir.match(/^\/([A-Za-z])\//)
      if (driveMatch) {
        const windowsDir = `${driveMatch[1]}:${dir.slice(2)}`
          .replace(/\//g, '\\')
        const winCandidate = pathWin32.join(windowsDir, 'bash.exe')
        if (checkPathExists(winCandidate)) {
          return winCandidate
        }
      }
    }
  }

  // 4. Fallback: find git.exe via where.exe, derive bash path from it
  const gitPath = findExecutable('git')
  if (gitPath) {
    // Git Bash installs bash at multiple possible locations relative to git.exe
    const candidates = [
      // Standard Git for Windows: C:\Program Files\Git\cmd\git.exe -> ..\..\bin\bash.exe
      pathWin32.join(gitPath, '..', '..', 'bin', 'bash.exe'),
      // MSYS2-based installs: C:\Program Files\Git\mingw64\bin\git.exe -> ..\..\usr\bin\bash.exe
      pathWin32.join(gitPath, '..', '..', 'usr', 'bin', 'bash.exe'),
    ]
    for (const bashPath of candidates) {
      if (checkPathExists(bashPath)) {
        return bashPath
      }
    }
  }

  // biome-ignore lint/suspicious/noConsole:: intentional console output
  console.error(
    'Claude Code on Windows requires git-bash (https://git-scm.com/downloads/win). If installed but not in PATH, set environment variable pointing to your bash.exe, similar to: CLAUDE_CODE_GIT_BASH_PATH=C:\\tools\\Git\\bin\\bash.exe',
  )
  // eslint-disable-next-line custom-rules/no-process-exit
  process.exit(1)
})

/** Convert a Windows path to a POSIX path using pure JS. */
export const windowsPathToPosixPath = memoizeWithLRU(
  (windowsPath: string): string => {
    // Handle UNC paths: \\server\share -> //server/share
    if (windowsPath.startsWith('\\\\')) {
      return windowsPath.replace(/\\/g, '/')
    }
    // Handle drive letter paths: C:\Users\foo -> /c/Users/foo
    const match = windowsPath.match(/^([A-Za-z]):[/\\]/)
    if (match) {
      const driveLetter = match[1]!.toLowerCase()
      return '/' + driveLetter + windowsPath.slice(2).replace(/\\/g, '/')
    }
    // Already POSIX or relative — just flip slashes
    return windowsPath.replace(/\\/g, '/')
  },
  (p: string) => p,
  500,
)

/** Convert a POSIX path to a Windows path using pure JS. */
export const posixPathToWindowsPath = memoizeWithLRU(
  (posixPath: string): string => {
    // Handle UNC paths: //server/share -> \\server\share
    if (posixPath.startsWith('//')) {
      return posixPath.replace(/\//g, '\\')
    }
    // Handle /cygdrive/c/... format
    const cygdriveMatch = posixPath.match(/^\/cygdrive\/([A-Za-z])(\/|$)/)
    if (cygdriveMatch) {
      const driveLetter = cygdriveMatch[1]!.toUpperCase()
      const rest = posixPath.slice(('/cygdrive/' + cygdriveMatch[1]).length)
      return driveLetter + ':' + (rest || '\\').replace(/\//g, '\\')
    }
    // Handle /c/... format (MSYS2/Git Bash)
    const driveMatch = posixPath.match(/^\/([A-Za-z])(\/|$)/)
    if (driveMatch) {
      const driveLetter = driveMatch[1]!.toUpperCase()
      const rest = posixPath.slice(2)
      return driveLetter + ':' + (rest || '\\').replace(/\//g, '\\')
    }
    // Already Windows or relative — just flip slashes
    return posixPath.replace(/\//g, '\\')
  },
  (p: string) => p,
  500,
)
