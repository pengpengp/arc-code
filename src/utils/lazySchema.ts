/**
 * Returns a memoized factory function that constructs the value on first call.
 * Used to defer Zod schema construction from module init time to first access.
 */
export function lazySchema<T>(factory: () => T): () => T {
  let cached: T | undefined
  return () => {
    if (cached === undefined) {
      try {
        cached = factory()
      } catch (e) {
        console.error('[lazySchema] factory error:', e)
        throw e
      }
    }
    return cached
  }
}
