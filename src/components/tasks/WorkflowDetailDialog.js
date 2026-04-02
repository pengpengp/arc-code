import React from 'react'
import { Box, Text } from '../../ink.js'

export function WorkflowDetailDialog({ workflow, onDone, onKill, onSkipAgent, onRetryAgent, onBack }) {
  if (!workflow) return null
  const statusColor = workflow.status === 'running' ? 'green' : workflow.status === 'killed' ? 'yellow' : 'red'
  return React.createElement(Box, { flexDirection: 'column', padding: 1 },
    React.createElement(Text, { bold: true }, 'Workflow Details'),
    React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
      React.createElement(Text, null, `Workflow: ${workflow.workflowName || workflow.label}`),
      React.createElement(Text, null, `Status: `, React.createElement(Text, { color: statusColor }, workflow.status)),
      workflow.startedAt && React.createElement(Text, null, `Started: ${workflow.startedAt}`),
    ),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: 'blue' }, 'Press q to go back'),
    ),
  )
}
