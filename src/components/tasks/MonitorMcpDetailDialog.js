import React from 'react'
import { Box, Text } from '../../ink.js'

export function MonitorMcpDetailDialog({ task, onKill, onBack }) {
  if (!task) return null

  const statusColor = task.status === 'running' ? 'green' :
                      task.status === 'killed' ? 'yellow' :
                      task.status === 'failed' ? 'red' : 'white'

  return React.createElement(Box, { flexDirection: 'column', padding: 1 },
    React.createElement(Text, { bold: true }, 'Monitor MCP Details'),
    React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
      React.createElement(Text, null, `Target: ${task.target || 'N/A'}`),
      React.createElement(Text, null, `Status: `, React.createElement(Text, { color: statusColor }, task.status)),
      React.createElement(Text, null, `Interval: ${task.interval || 30}s`),
      React.createElement(Text, null, `Checks: ${task.checkCount || 0}`),
      React.createElement(Text, null, `Errors: ${task.errorCount || 0}`),
      task.lastCheck && React.createElement(Text, null, `Last Check: ${task.lastCheck}`),
      task.lastStatus && React.createElement(Text, null, `Last Status: ${task.lastStatus}`),
      task.lastLatency !== undefined && React.createElement(Text, null, `Last Latency: ${task.lastLatency}ms`),
      task.startedAt && React.createElement(Text, null, `Started: ${task.startedAt}`),
    ),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: 'blue' }, 'Press q to go back'),
      onKill && task.status === 'running' && React.createElement(Text, { marginLeft: 2, color: 'red' }, 'Press k to kill'),
    ),
  )
}
