/**
 * MCP Skills - Fetch skills from MCP servers via resources.
 * MCP servers can expose skills through their resource endpoints.
 */

/**
 * Fetch MCP skills from a connected MCP client
 * @param {import('./mcp/types.js').MCPServerConnection} client
 * @returns {Promise<Array>}
 */
export async function fetchMcpSkillsForClient(client) {
  if (!client?.resources) return []

  const skills = []
  for (const resource of client.resources) {
    try {
      // Read the resource to check if it's a skill manifest
      const content = await client.readResource(resource.uri)
      if (content && typeof content === 'string') {
        try {
          const parsed = JSON.parse(content)
          if (parsed?.type === 'skill' || parsed?.type === 'mcp-skill') {
            skills.push({
              name: parsed.name || resource.name,
              description: parsed.description || '',
              source: 'mcp',
              serverName: client.name,
              uri: resource.uri,
              content: parsed,
            })
          }
        } catch {
          // Not JSON, skip
        }
      }
    } catch {
      // Failed to read resource, skip
    }
  }

  return skills
}
