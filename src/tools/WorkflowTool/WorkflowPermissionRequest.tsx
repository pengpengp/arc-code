import React from 'react'
import { Box, Text } from '../../ink.js'

export function WorkflowPermissionRequest({ toolName, toolInput, onAllow, onDeny }) {
  return React.createElement(Box, { flexDirection: 'column', padding: 1 },
    React.createElement(Text, { bold: true }, 'Workflow Permission'),
    React.createElement(Text, null, `Workflow: ${toolInput?.workflow_name || 'unknown'}`),
    React.createElement(Text, null, `Action: ${toolInput?.action || 'run'}`),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: 'green' }, '[Enter] Allow'),
      React.createElement(Text, { marginLeft: 2, color: 'red' }, '[Esc] Deny'),
    ),
  )
}
