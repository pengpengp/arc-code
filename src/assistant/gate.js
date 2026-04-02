/**
 * KAIROS Gate - Controls access to assistant features.
 * Checks GrowthBook feature flags and user entitlements.
 */
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/growthbook.js'
import { isAssistantMode } from './index.js'

/**
 * Check if KAIROS is enabled
 */
export async function isKairosEnabled() {
  // Check GrowthBook feature flag
  const kairosGate = getFeatureValue_CACHED_MAY_BE_STALE('tengu_kairos', false)
  return kairosGate || isAssistantMode()
}

/**
 * Check if brief mode is enabled
 */
export async function isBriefEnabled() {
  const briefGate = getFeatureValue_CACHED_MAY_BE_STALE('tengu_kairos_brief', false)
  return briefGate
}

/**
 * Check if dream mode is enabled
 */
export async function isDreamEnabled() {
  const dreamGate = getFeatureValue_CACHED_MAY_BE_STALE('tengu_kairos_dream', false)
  return dreamGate
}

/**
 * Check if proactive mode is enabled
 */
export async function isProactiveEnabled() {
  const proactiveGate = getFeatureValue_CACHED_MAY_BE_STALE('tengu_kairos_proactive', false)
  return proactiveGate
}
