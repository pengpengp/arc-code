import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { randomUUID } from 'crypto'
import type { ZodTypeAny } from 'zod/v4'
import type {
  ForkSessionOptions,
  ForkSessionResult,
  GetSessionInfoOptions,
  GetSessionMessagesOptions,
  InferShape,
  ListSessionsOptions,
  McpSdkServerConfigWithInstance,
  SDKSession,
  SDKSessionOptions,
  SdkMcpToolDefinition,
  SessionMutationOptions,
} from './runtimeTypes.js'
import type { SDKMessage, SDKResultMessage, SDKSessionInfo } from './coreTypes.js'
import {
  listSessionsImpl,
  parseSessionInfoFromLite,
} from '../../utils/listSessionsImpl.js'
import {
  resolveSessionFilePath,
  readSessionLite,
} from '../../utils/sessionStoragePortable.js'
import { saveCustomTitle, saveTag } from '../../utils/sessionStorage.js'
import { buildMissedTaskNotification as buildMissedTaskNotificationImpl, createCronScheduler } from '../../utils/cronScheduler.js'
import type { CronJitterConfig, CronTask } from '../../utils/cronTasks.js'
import { logForDebugging } from '../../utils/debug.js'
import {
  createSession,
  resumeSession,
  queryImpl,
  promptImpl,
} from './sdkSessionContext.js'

export type AnyZodRawShape = Record<string, ZodTypeAny>

export type CronTaskType = CronTask
export type CronJitterConfigType = CronJitterConfig

export type ScheduledTaskEvent =
  | { type: 'fire'; task: CronTask }
  | { type: 'missed'; tasks: CronTask[] }

export type ScheduledTasksHandle = {
  events(): AsyncGenerator<ScheduledTaskEvent>
  getNextFireTime(): number | null
}

export type InboundPrompt = {
  content: string | unknown[]
  uuid?: string
}

export type ConnectRemoteControlOptions = {
  dir: string
  name?: string
  workerType?: string
  branch?: string
  gitRepoUrl?: string | null
  getAccessToken: () => string | undefined
  baseUrl: string
  orgUUID: string
  model: string
}

export type RemoteControlHandle = {
  sessionUrl: string
  environmentId: string
  bridgeSessionId: string
  write(msg: SDKMessage): void
  sendResult(): void
  sendControlRequest(req: unknown): void
  sendControlResponse(res: unknown): void
  sendControlCancelRequest(requestId: string): void
  inboundPrompts(): AsyncGenerator<InboundPrompt>
  controlRequests(): AsyncGenerator<unknown>
  permissionResponses(): AsyncGenerator<unknown>
  onStateChange(
    cb: (
      state: 'ready' | 'connected' | 'reconnecting' | 'failed',
      detail?: string,
    ) => void,
  ): void
  teardown(): Promise<void>
}

export function tool<Schema extends AnyZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: InferShape<Schema>, extra: unknown) => Promise<CallToolResult>,
  extras?: {
    annotations?: ToolAnnotations
    searchHint?: string
    alwaysLoad?: boolean
  },
): SdkMcpToolDefinition<Schema> {
  return {
    name,
    description,
    inputSchema,
    handler,
    annotations: extras?.annotations,
    searchHint: extras?.searchHint,
    alwaysLoad: extras?.alwaysLoad,
  }
}

type CreateSdkMcpServerOptions = {
  name: string
  version?: string
  tools?: Array<SdkMcpToolDefinition<AnyZodRawShape>>
}

export function createSdkMcpServer(
  options: CreateSdkMcpServerOptions,
): McpSdkServerConfigWithInstance {
  const { name, version = '1.0.0', tools = [] } = options
  const server = new McpServer({ name, version })

  for (const toolDef of tools) {
    const shape = toolDef.inputSchema
    server.tool(
      toolDef.name,
      toolDef.description,
      shape as Record<string, ZodTypeAny>,
      async (args: Record<string, unknown>, extra: unknown) => {
        return toolDef.handler(args as InferShape<typeof toolDef.inputSchema>, extra)
      },
    )
  }

  return {
    server,
    async connect() {
      const transport = new StdioServerTransport()
      await server.connect(transport)
    },
  }
}

export async function listSessions(
  options?: ListSessionsOptions,
): Promise<SDKSessionInfo[]> {
  const sessions = await listSessionsImpl(options)
  return sessions.map(s => ({
    sessionId: s.sessionId,
    summary: s.summary,
    cwd: s.cwd,
    createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : undefined,
    updatedAt: s.lastModified ? new Date(s.lastModified).toISOString() : undefined,
  }))
}

export async function getSessionInfo(
  sessionId: string,
  options?: GetSessionInfoOptions,
): Promise<SDKSessionInfo | undefined> {
  const resolved = await resolveSessionFilePath(sessionId, options?.dir)
  if (!resolved) return undefined

  const lite = await readSessionLite(resolved.filePath)
  if (!lite) return undefined

  const info = parseSessionInfoFromLite(sessionId, lite, resolved.projectPath)
  if (!info) return undefined

  return {
    sessionId: info.sessionId,
    summary: info.summary,
    cwd: info.cwd,
    createdAt: info.createdAt ? new Date(info.createdAt).toISOString() : undefined,
    updatedAt: info.lastModified ? new Date(info.lastModified).toISOString() : undefined,
  }
}

export async function getSessionMessages(
  sessionId: string,
  options?: GetSessionMessagesOptions,
): Promise<{ type: string; uuid: string; raw: string }[]> {
  const resolved = await resolveSessionFilePath(sessionId, options?.dir)
  if (!resolved) return []

  const { readFile } = await import('fs/promises')
  const content = await readFile(resolved.filePath, 'utf8')
  const lines = content.trim().split('\n')

  const messages: { type: string; uuid: string; raw: string }[] = []
  const limit = options?.limit
  const offset = options?.offset ?? 0
  const includeSystem = options?.includeSystemMessages ?? false

  let count = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') continue
    try {
      const entry = JSON.parse(lines[i]) as { type?: string; uuid?: string }
      if (entry.type === 'user' || entry.type === 'assistant') {
        if (count >= offset) {
          if (limit !== undefined && messages.length >= limit) break
          messages.push({
            type: entry.type,
            uuid: entry.uuid ?? '',
            raw: lines[i],
          })
        }
        count++
      } else if (includeSystem && entry.type === 'system') {
        if (count >= offset) {
          if (limit !== undefined && messages.length >= limit) break
          messages.push({
            type: 'system',
            uuid: entry.uuid ?? '',
            raw: lines[i],
          })
        }
        count++
      }
    } catch {
      // skip
    }
  }

  return messages
}

export async function renameSession(
  sessionId: string,
  title: string,
  options?: SessionMutationOptions,
): Promise<void> {
  const resolved = await resolveSessionFilePath(sessionId, options?.dir)
  if (!resolved) {
    throw new Error(`Session not found: ${sessionId}`)
  }
  await saveCustomTitle(sessionId as import('crypto').UUID, title, resolved.filePath)
}

export async function tagSession(
  sessionId: string,
  tag: string | null,
  options?: SessionMutationOptions,
): Promise<void> {
  const resolved = await resolveSessionFilePath(sessionId, options?.dir)
  if (!resolved) {
    throw new Error(`Session not found: ${sessionId}`)
  }
  if (tag === null) {
    await saveTag(sessionId as import('crypto').UUID, '', resolved.filePath)
  } else {
    await saveTag(sessionId as import('crypto').UUID, tag, resolved.filePath)
  }
}

export async function forkSession(
  sessionId: string,
  options?: ForkSessionOptions,
): Promise<ForkSessionResult> {
  const resolved = await resolveSessionFilePath(sessionId, options?.dir)
  if (!resolved) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  const { writeFile, readFile } = await import('fs/promises')
  const { dirname, join } = await import('path')

  const newSessionId = randomUUID() as `${string}-${string}-${string}-${string}-${string}`
  const content = await readFile(resolved.filePath, 'utf8')
  const lines = content.trim().split('\n')

  const uuidMap = new Map<string, string>()
  const newLines: string[] = []

  for (const line of lines) {
    if (line.trim() === '') continue
    try {
      const entry = JSON.parse(line) as { uuid?: string; parentUuid?: string }
      const oldUuid = entry.uuid
      if (oldUuid && !uuidMap.has(oldUuid)) {
        uuidMap.set(oldUuid, randomUUID())
      }
      if (entry.parentUuid && !uuidMap.has(entry.parentUuid)) {
        uuidMap.set(entry.parentUuid, randomUUID())
      }

      const newEntry = { ...entry }
      if (oldUuid) newEntry.uuid = uuidMap.get(oldUuid)
      if (entry.parentUuid) newEntry.parentUuid = uuidMap.get(entry.parentUuid)

      newLines.push(JSON.stringify(newEntry))
    } catch {
      newLines.push(line)
    }
  }

  const dir = dirname(resolved.filePath)
  const newFilePath = join(dir, `${newSessionId}.jsonl`)
  await writeFile(newFilePath, newLines.join('\n') + '\n')

  return { sessionId: newSessionId }
}

export function buildMissedTaskNotification(missed: CronTask[]): string {
  return buildMissedTaskNotificationImpl(missed)
}

export function watchScheduledTasks(opts: {
  dir: string
  signal: AbortSignal
  getJitterConfig?: () => CronJitterConfig
}): ScheduledTasksHandle {
  const pendingFires: CronTask[] = []
  const pendingMissed: CronTask[][] = []
  let nextFireTime: number | null = null

  const scheduler = createCronScheduler({
    dir: opts.dir,
    getJitterConfig: opts.getJitterConfig,
    onFire: (prompt: string) => {
      pendingFires.push({ id: '', cron: '', prompt, createdAt: Date.now() })
    },
    onMissed: (tasks: CronTask[]) => {
      pendingMissed.push(tasks)
    },
    isLoading: () => false,
    isKilled: () => opts.signal.aborted,
  })

  scheduler.start()

  async function* events(): AsyncGenerator<ScheduledTaskEvent> {
    while (!opts.signal.aborted) {
      while (pendingFires.length > 0) {
        const task = pendingFires.shift()!
        yield { type: 'fire', task }
      }
      while (pendingMissed.length > 0) {
        const tasks = pendingMissed.shift()!
        yield { type: 'missed', tasks }
      }
      nextFireTime = scheduler.getNextFireTime()
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return {
    events,
    getNextFireTime: () => nextFireTime,
  }
}

export async function connectRemoteControl(
  opts: ConnectRemoteControlOptions,
): Promise<RemoteControlHandle | null> {
  try {
    const { createV2ReplTransport } = await import('../../bridge/replBridgeTransport.js')
    const { handleIngressMessage } = await import('../../bridge/bridgeMessaging.js')
    const { createCodeSession, fetchRemoteCredentials } = await import('../../bridge/codeSessionApi.js')

    const accessToken = opts.getAccessToken()
    if (!accessToken) {
      logForDebugging('[SDK] connectRemoteControl: no access token available')
      return null
    }

    const sessionId = await createCodeSession(
      opts.baseUrl,
      accessToken,
      opts.name ?? 'SDK Remote Control',
      30_000,
    )
    if (!sessionId) {
      logForDebugging('[SDK] connectRemoteControl: failed to create code session')
      return null
    }

    const credentials = await fetchRemoteCredentials(
      sessionId,
      opts.baseUrl,
      accessToken,
      30_000,
    )
    if (!credentials) {
      logForDebugging('[SDK] connectRemoteControl: failed to fetch credentials')
      return null
    }

    const sessionUrl = `${credentials.api_base_url}/v1/code/sessions/${sessionId}`
    const transport = await createV2ReplTransport({
      sessionUrl,
      ingressToken: credentials.worker_jwt,
      sessionId,
      epoch: credentials.worker_epoch,
      getAuthToken: opts.getAccessToken,
    })

    const inboundPromptsQueue: InboundPrompt[] = []
    const controlRequestsQueue: unknown[] = []
    const permissionResponsesQueue: unknown[] = []
    const stateChangeCallbacks: Array<(state: 'ready' | 'connected' | 'reconnecting' | 'failed', detail?: string) => void> = []

    const recentPostedUUIDs = new Set<string>()
    const recentInboundUUIDs = new Set<string>()

    transport.setOnConnect(() => {
      for (const cb of stateChangeCallbacks) cb('connected')
    })

    transport.setOnData((data: string) => {
      handleIngressMessage(
        data,
        recentPostedUUIDs as any,
        recentInboundUUIDs as any,
        (msg: any) => {
          if (msg.type === 'user') {
            inboundPromptsQueue.push({
              content: msg.message?.content ?? '',
              uuid: msg.uuid,
            })
          }
        },
        (res: unknown) => {
          permissionResponsesQueue.push(res)
        },
        (req: unknown) => {
          controlRequestsQueue.push(req)
        },
      )
    })

    transport.setOnClose(() => {
      for (const cb of stateChangeCallbacks) cb('reconnecting')
    })

    transport.connect()

    return {
      sessionUrl,
      environmentId: '',
      bridgeSessionId: sessionId,
      write(msg: SDKMessage) {
        transport.write(msg as any)
      },
      sendResult() {
        transport.write({
          type: 'result',
          subtype: 'success',
          result: '',
          duration_ms: 0,
          session_id: sessionId,
          uuid: randomUUID(),
        } as any)
      },
      sendControlRequest(req: unknown) {
        transport.write(req as any)
      },
      sendControlResponse(res: unknown) {
        transport.write(res as any)
      },
      sendControlCancelRequest(requestId: string) {
        transport.write({
          type: 'control_cancel_request',
          request_id: requestId,
        } as any)
      },
      async *inboundPrompts(): AsyncGenerator<InboundPrompt> {
        while (true) {
          while (inboundPromptsQueue.length > 0) {
            yield inboundPromptsQueue.shift()!
          }
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      },
      async *controlRequests(): AsyncGenerator<unknown> {
        while (true) {
          while (controlRequestsQueue.length > 0) {
            yield controlRequestsQueue.shift()!
          }
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      },
      async *permissionResponses(): AsyncGenerator<unknown> {
        while (true) {
          while (permissionResponsesQueue.length > 0) {
            yield permissionResponsesQueue.shift()!
          }
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      },
      onStateChange(cb) {
        stateChangeCallbacks.push(cb)
      },
      async teardown() {
        transport.close()
      },
    }
  } catch (e) {
    logForDebugging(`[SDK] connectRemoteControl failed: ${e}`)
    return null
  }
}

export class AbortError extends Error {}

export async function unstable_v2_createSession(options: SDKSessionOptions): Promise<SDKSession> {
  return createSession(options)
}

export async function unstable_v2_resumeSession(sessionId: string, options: SDKSessionOptions): Promise<SDKSession> {
  return resumeSession(sessionId, options)
}

export async function unstable_v2_prompt(message: string, options: SDKSessionOptions): Promise<SDKResultMessage> {
  return promptImpl(message, options)
}
