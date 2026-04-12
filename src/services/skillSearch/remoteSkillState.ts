/**
 * Remote Skill State — manages remote skill search state.
 * Stub for EXPERIMENTAL_SKILL_SEARCH flag.
 */

export interface RemoteSkillState {
  enabled: boolean
  lastSynced?: string
}

export async function getRemoteSkillState(): Promise<RemoteSkillState> {
  return { enabled: false }
}

export async function refreshRemoteSkillState(): Promise<RemoteSkillState> {
  return { enabled: false }
}
