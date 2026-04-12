/**
 * MCP Skills — discovers MCP server capabilities and exposes them as
 * Claude "skills" (commands) that can be invoked via SkillTool.
 * Used by MCP_SKILLS feature flag.
 */

import { getMCPSkillBuilders } from './mcpSkillBuilders.js'
import memoize from 'lodash-es/memoize.js'

/**
 * Fetch skills from an MCP client by reading skill:// resources.
 * Converts MCP resource entries into skill commands.
 */
export async function fetchMcpSkillsForClient(client) {
  const resources = client._resources || []
  if (!Array.isArray(resources) || resources.length === 0) return []

  const { createSkillCommand, parseSkillFrontmatterFields } = getMCPSkillBuilders()

  const skills = []
  for (const resource of resources) {
    // Only process skill:// protocol resources
    const uri = resource.uri || ''
    if (!uri.startsWith('skill://')) continue

    const skillName = uri.replace('skill://', '').split('/')[0]
    if (!skillName) continue

    try {
      // Read the skill resource content
      const content = await client.readResource(uri)
      if (!content) continue

      // Parse frontmatter and create skill command
      const fields = parseSkillFrontmatterFields(content)
      const command = createSkillCommand(fields, content)
      if (command) {
        skills.push(command)
      }
    } catch {
      // Skip resources that can't be read
    }
  }
  return skills
}

// Memoize by client name to avoid re-parsing on every call
export const fetchMcpSkillsForClientMemoized = memoize(fetchMcpSkillsForClient, (client) => client.name)

/**
 * Get all MCP skill commands (exposed for backward compatibility).
 */
export function getMcpSkillCommands() {
  // Returns the skill builders for direct use
  try {
    return getMCPSkillBuilders()
  } catch {
    return null
  }
}
