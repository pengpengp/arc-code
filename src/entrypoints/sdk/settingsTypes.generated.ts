export type Settings = {
  $schema?: string
  apiKeyHelper?: string
  awsCredentialExport?: string
  awsAuthRefresh?: string
  gcpAuthRefresh?: string
  fileSuggestion?: {
    type: 'command'
    command: string
  }
  respectGitignore?: boolean
  cleanupPeriodDays?: number
  env?: Record<string, string>
  permissions?: {
    allow?: string[]
    deny?: string[]
    default?: string[]
  }
  mcpServers?: Record<string, unknown>
}
