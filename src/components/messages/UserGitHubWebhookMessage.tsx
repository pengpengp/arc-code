/**
 * UserGitHubWebhookMessage — renders GitHub webhook activity messages.
 * Stub for KAIROS_GITHUB_WEBHOOKS flag.
 */

import React from 'react'

interface Props {
  addMargin?: boolean
  param: { text: string }
}

export function UserGitHubWebhookMessage({ addMargin, param }: Props) {
  return (
    <div style={{ margin: addMargin ? '8px 0' : 0 }}>
      <pre>{param.text}</pre>
    </div>
  )
}
