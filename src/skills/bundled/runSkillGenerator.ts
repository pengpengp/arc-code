/**
 * Stub for RUN_SKILL_GENERATOR feature flag.
 * Skill generator registration is not available in this build.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { registerBundledSkill } = require('../bundledSkills.js')
/* eslint-enable @typescript-eslint/no-require-imports */

export function registerRunSkillGeneratorSkill() {
  registerBundledSkill({
    name: 'run-skill-generator',
    description:
      'Generate and register a new skill from a prompt or description (not available in this build).',
    getPromptForCommand: async () => {
      return [
        {
          type: 'text',
          text: 'The skill generator is not available in this build. ' +
            'You can create skill files manually by writing to the skills directory.',
        },
      ]
    },
  })
}
