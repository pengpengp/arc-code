/**
 * Cross-platform TTY detection.
 * On Windows MSYS2/Cygwin (Git Bash), process.stdout.isTTY and
 * process.stdin.isTTY return `undefined` even in real interactive terminals.
 * This module provides reliable checks that fall back to the TERM env var.
 */

/**
 * Check if stdout/stderr is likely an interactive terminal.
 * On MSYS2/Git Bash, isTTY can be undefined even in real terminals.
 * Falls back to TERM env var when isTTY is undefined.
 */
export function isStdoutTTY(): boolean {
  return process.stdout.isTTY !== undefined
    ? process.stdout.isTTY
    : !!process.env.TERM;
}

/**
 * Same for stdin.
 */
export function isStdinTTY(): boolean {
  return process.stdin.isTTY !== undefined
    ? process.stdin.isTTY
    : !!process.env.TERM;
}
