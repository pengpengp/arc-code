/**
 * Task Summary for Background Sessions.
 * Generates a summary of what was accomplished in a bg session.
 */
export function shouldGenerateTaskSummary() {
  return true
}

export function maybeGenerateTaskSummary(options) {
  const { messages, toolUses, toolResults } = options
  // Generate a summary of tool usage and results
  const toolUseCount = toolUses?.length || 0
  const successCount = toolResults?.filter(r => !r.is_error)?.length || 0
  const errorCount = toolResults?.filter(r => r.is_error)?.length || 0

  let summary = `Task completed. ${toolUseCount} tool calls made.`
  if (successCount > 0) summary += ` ${successCount} succeeded.`
  if (errorCount > 0) summary += ` ${errorCount} failed.`

  return summary
}
