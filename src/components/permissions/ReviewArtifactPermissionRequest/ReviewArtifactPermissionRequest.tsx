import React from 'react'
import { Box, Text } from '../../../ink.js'

export function ReviewArtifactPermissionRequest({ toolName, toolInput, onAllow, onDeny }) {
  return React.createElement(Box, { flexDirection: 'column', padding: 1 },
    React.createElement(Text, { bold: true }, 'Review Permission'),
    React.createElement(Text, null, `Reviewing: ${toolInput?.files?.join(', ') || 'all changes'}`),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: 'green' }, '[Enter] Allow'),
      React.createElement(Text, { marginLeft: 2, color: 'red' }, '[Esc] Deny'),
    ),
  )
}
