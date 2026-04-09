import React from 'react'
import { Box, Text } from '../../../ink.js'

export function MonitorPermissionRequest({ toolName, toolInput, onAllow, onDeny }) {
  return React.createElement(Box, { flexDirection: 'column', padding: 1 },
    React.createElement(Text, { bold: true }, 'Monitor Permission'),
    React.createElement(Text, null, `Tool: ${toolName || 'monitor'}`),
    React.createElement(Text, null, `Action: ${toolInput?.action || 'status'}`),
    toolInput?.target && React.createElement(Text, null, `Target: ${toolInput.target}`),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: 'green' }, '[Enter] Allow'),
      React.createElement(Text, { marginLeft: 2, color: 'red' }, '[Esc] Deny'),
    ),
  )
}
