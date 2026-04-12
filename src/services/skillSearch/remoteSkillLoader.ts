/**
 * Remote Skill Loader — loads skill definitions from remote registry.
 * Stub for EXPERIMENTAL_SKILL_SEARCH flag.
 */

export interface RemoteSkillDef {
  name: string
  description: string
}

export async function loadRemoteSkills(): Promise<RemoteSkillDef[]> {
  return []
}

export async function loadRemoteSkill(name: string): Promise<string | null> {
  return null
}
