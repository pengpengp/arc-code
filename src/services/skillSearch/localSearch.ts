/**
 * Local Skill Search - Full-text indexing for skill discovery.
 * Builds an index of available skills and provides fast search.
 */
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { logForDebugging } from '../../utils/debug.js'

const SKILL_INDEX_CACHE = { index: null, lastUpdated: 0, ttl: 60000 }

function buildSkillIndex() {
  const skills = []
  const dirs = [
    join(getClaudeConfigHomeDir(), 'skills'),
    join(process.cwd(), '.claude', 'skills'),
  ]

  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillFile = join(dir, entry.name, 'SKILL.md')
          if (existsSync(skillFile)) {
            const content = readFileSync(skillFile, 'utf-8')
            const nameMatch = content.match(/^#\s+(.+)$/m)
            const descMatch = content.match(/^description:\s*(.+)$/im)
            skills.push({
              name: nameMatch ? nameMatch[1].trim() : entry.name,
              description: descMatch ? descMatch[1].trim() : '',
              path: skillFile,
              content: content.slice(0, 500),
            })
          }
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.yaml')) {
          const content = readFileSync(join(dir, entry.name), 'utf-8')
          const nameMatch = content.match(/^#\s+(.+)$/m)
          skills.push({
            name: nameMatch ? nameMatch[1].trim() : entry.name.replace(/\.(md|yaml)$/, ''),
            description: '',
            path: join(dir, entry.name),
            content: content.slice(0, 500),
          })
        }
      }
    } catch (err) {
      logForDebugging(`Failed to index skills in ${dir}: ${err.message}`)
    }
  }

  return skills
}

export function getSkillIndex() {
  const now = Date.now()
  if (!SKILL_INDEX_CACHE.index || now - SKILL_INDEX_CACHE.lastUpdated > SKILL_INDEX_CACHE.ttl) {
    SKILL_INDEX_CACHE.index = buildSkillIndex()
    SKILL_INDEX_CACHE.lastUpdated = now
  }
  return SKILL_INDEX_CACHE.index
}

export function searchSkills(query, options = {}) {
  const { limit = 10 } = options
  const index = getSkillIndex()
  const terms = query.toLowerCase().split(/\s+/)

  const scored = index.map(skill => {
    const text = `${skill.name} ${skill.description} ${skill.content}`.toLowerCase()
    let score = 0
    for (const term of terms) {
      if (skill.name.toLowerCase().includes(term)) score += 10
      if (skill.description.toLowerCase().includes(term)) score += 5
      if (text.includes(term)) score += 1
    }
    return { ...skill, score }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function clearSkillIndexCache() {
  SKILL_INDEX_CACHE.index = null
  SKILL_INDEX_CACHE.lastUpdated = 0
}

export function isSkillSearchEnabled() {
  return true
}
