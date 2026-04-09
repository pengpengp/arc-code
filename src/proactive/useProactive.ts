import { useState, useEffect } from 'react'
import { getProactiveState } from './index.js'

export function useProactive() {
  const [state, setState] = useState(() => getProactiveState())

  useEffect(() => {
    setState(getProactiveState())
  }, [])

  return {
    isProactive: state.active,
    insights: state.insights,
    tasks: state.tasks,
    pendingCount: state.pendingCount,
  }
}
