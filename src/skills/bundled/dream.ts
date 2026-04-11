/**
 * KAIROS Dream Mode - Background autonomous task processing.
 * Delegates to the full implementation in src/dream.ts.
 */
import { setupDream } from '../../dream.js'

export function registerDreamSkill() {
  setupDream()
}
