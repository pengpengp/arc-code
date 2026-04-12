/**
 * UserCrossSessionMessage — renders cross-session UDS messages.
 * Stub implementation for UDS_INBOX feature flag.
 */

import React from 'react'

interface Props {
  addMargin?: boolean
  param: { text: string }
}

export function UserCrossSessionMessage({ addMargin, param }: Props) {
  return <div style={{ margin: addMargin ? '8px 0' : 0 }}>{param.text}</div>
}
