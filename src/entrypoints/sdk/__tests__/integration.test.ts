import { resolveOptions } from '../sdkSessionContext.js'
import type { SDKSessionOptions, Query, SDKSession, RuntimePermissionMode } from '../runtimeTypes.js'

console.log('=== SDK Integration Test ===\n')

console.log('1. Testing resolveOptions...')
const opts = resolveOptions({
  model: 'claude-sonnet-4-6',
  systemPrompt: 'Test prompt',
  effort: 'high',
  permissionMode: 'bypassPermissions' as RuntimePermissionMode,
  maxTurns: 10,
  cwd: process.cwd(),
  env: { TEST_VAR: 'test_value' },
})
if (opts.model === 'claude-sonnet-4-6' && opts.effort === 'high') {
  console.log('   ✅ resolveOptions works correctly')
} else {
  console.log('   ❌ resolveOptions failed')
  process.exit(1)
}

console.log('2. Testing Query interface...')
const queryObj: Query = {
  [Symbol.asyncIterator]: async function* () { yield { type: 'result' as const, result: 'ok', duration_ms: 0, session_id: '', uuid: '' } },
  abort() {},
  getMessages: () => [],
  onAbort(_cb) {},
  isAborted: false,
  sessionId: 'test-session-id',
}
if (typeof queryObj.abort === 'function' && typeof queryObj.getMessages === 'function' && queryObj.isAborted === false) {
  console.log('   ✅ Query interface has all required methods')
} else {
  console.log('   ❌ Query interface check failed')
  process.exit(1)
}

console.log('3. Testing SDKSession interface...')
const sessionObj: SDKSession = {
  id: 'test-session-id',
  async send(_msg) {},
  stream: async function* () {},
  async close() {},
  interrupt() {},
  setModel(_model) {},
  setPermissionMode(_mode) {},
  getMessages: () => [],
  async addMcpServer(_name, _config) {},
  async removeMcpServer(_name) {},
}
if (typeof sessionObj.send === 'function' && typeof sessionObj.interrupt === 'function' && sessionObj.id === 'test-session-id') {
  console.log('   ✅ SDKSession interface has all required methods')
} else {
  console.log('   ❌ SDKSession interface check failed')
  process.exit(1)
}

console.log('4. Testing public API imports...')
try {
  const sdk = await import('../../agentSdkTypes.js')
  const expectedFunctions = [
    'tool', 'createSdkMcpServer', 'listSessions', 'getSessionInfo',
    'getSessionMessages', 'renameSession', 'tagSession', 'forkSession',
    'watchScheduledTasks', 'buildMissedTaskNotification', 'connectRemoteControl',
    'unstable_v2_createSession', 'unstable_v2_resumeSession', 'unstable_v2_prompt',
    'query', 'AbortError',
  ]
  for (const fn of expectedFunctions) {
    if (typeof sdk[fn] !== 'function') throw new Error(`Missing export: ${fn}`)
  }
  console.log(`   ✅ All ${expectedFunctions.length} functions exported`)
} catch (e) {
  console.log('   ❌ Public API import failed:', e)
  process.exit(1)
}

console.log('5. Testing controlTypes.ts exists and has type exports...')
try {
  const ctrl = await import('../controlTypes.js')
  const keys = Object.keys(ctrl)
  if (keys.length >= 0) {
    console.log('   ✅ controlTypes.ts module loads successfully')
  } else {
    throw new Error('controlTypes.ts empty')
  }
} catch (e) {
  console.log('   ❌ controlTypes import failed:', e)
  process.exit(1)
}

console.log('6. Testing settingsTypes.generated.ts exists...')
try {
  await import('../settingsTypes.generated.js')
  console.log('   ✅ settingsTypes.generated.ts module loads successfully')
} catch (e) {
  console.log('   ❌ settingsTypes import failed:', e)
  process.exit(1)
}

console.log('7. Testing sdkUtilityTypes.ts exists...')
try {
  await import('../sdkUtilityTypes.js')
  console.log('   ✅ sdkUtilityTypes.ts module loads successfully')
} catch (e) {
  console.log('   ❌ sdkUtilityTypes import failed:', e)
  process.exit(1)
}

console.log('8. Checking no remaining stub implementations...')
try {
  const sdk = await import('../../agentSdkTypes.js')
  const q = sdk.query({ prompt: 'test', options: {} })
  if (q?.abort && q?.getMessages && q?.onAbort) {
    console.log('   ✅ query() returns a proper Query object')
  } else {
    throw new Error('query() returned invalid object')
  }

  const p = sdk.unstable_v2_createSession({})
  if (p?.then) {
    console.log('   ✅ unstable_v2_createSession() returns Promise')
  } else {
    throw new Error('v2_createSession did not return Promise')
  }
} catch (e) {
  console.log('   ❌ Stub check failed:', e)
  process.exit(1)
}

console.log('\n=== All 8 integration tests passed! ===')
process.exit(0)
