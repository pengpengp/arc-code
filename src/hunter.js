/**
 * Hunter - Code review artifact generator.
 * Stub for REVIEW_ARTIFACT flag.
 */

import { logForDebugging } from './utils/debug.js'

export async function runHunter(config) {
  const { files, baseBranch, targetBranch } = config || {}
  try {
    let diff = ''
    if (!files || files.length === 0) {
      diff = ''
    }
    const findings = []
    const suggestions = []
    if (diff) {
      if (diff.includes('console.log')) {
        findings.push({ type: 'info', message: 'console.log statements found' })
      }
      if (diff.includes('TODO') || diff.includes('FIXME')) {
        findings.push({ type: 'info', message: 'TODO/FIXME comments found' })
      }
      if (diff.includes('any')) {
        findings.push({ type: 'warning', message: 'TypeScript "any" type used' })
      }
    }
    logForDebugging(`Hunter review complete: ${findings.length} findings`)
    return {
      status: 'completed',
      findings,
      suggestions,
      diffSize: diff.length,
      message: findings.length > 0
        ? `Review complete: ${findings.length} finding(s).`
        : 'No issues found.',
    }
  } catch (err) {
    return {
      status: 'failed',
      message: `Hunter review failed: ${err.message}`,
    }
  }
}

export function getHunterState() {
  return { active: false, lastRun: null }
}
