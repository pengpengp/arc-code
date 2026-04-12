/**
 * Run skill generator — AI-driven skill creation from natural language prompts.
 * Used by RUN_SKILL_GENERATOR feature flag.
 */

import { registerBundledSkill } from './skills/bundledSkills.js'

export function registerRunSkillGeneratorSkill() {
  registerBundledSkill({
    name: 'run-skill-generator',
    description: 'Generate a new skill from a natural language description',
    async generate(prompt, _options) {
      const skillDef = parseSkillFromPrompt(prompt)
      if (!skillDef) {
        return { success: false, error: 'Could not parse a skill definition from the prompt' }
      }
      const validation = validateSkillDef(skillDef)
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }
      registerBundledSkill(skillDef)
      return { success: true, skill: skillDef }
    },
  })
}

function parseSkillFromPrompt(prompt) {
  const frontmatterMatch = prompt.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!frontmatterMatch) return null
  const fields = {}
  for (const line of (frontmatterMatch[1] || '').split('\n')) {
    const [key, ...valueParts] = line.split(':')
    if (key && valueParts.length > 0) {
      fields[key.trim()] = valueParts.join(':').trim()
    }
  }
  if (!fields.name) return null
  return {
    name: fields.name,
    description: fields.description || fields.name,
    prompt: (frontmatterMatch[2] || '').trim(),
    fields,
  }
}

function validateSkillDef(skillDef) {
  if (!skillDef.name || typeof skillDef.name !== 'string') {
    return { valid: false, error: 'Skill must have a name' }
  }
  if (!skillDef.prompt && !skillDef.description) {
    return { valid: false, error: 'Skill must have a prompt or description' }
  }
  return { valid: true }
}
