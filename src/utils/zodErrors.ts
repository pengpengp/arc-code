import type { ZodError } from 'zod/v4'

export function formatZodIssues(error: ZodError): string {
  return error.issues
    .map(err =>
      err.path.length > 0
        ? `${err.path.join('.')}: ${err.message}`
        : err.message,
    )
    .join(', ')
}
