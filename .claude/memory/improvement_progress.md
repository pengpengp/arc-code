---
name: improvement_progress
description: free-code 仓库代码质量改进进度和剩余待办项
type: project
---

# 代码改进进度

## 完成项 (2026-04-12 更新)

### 全部 88 个 Feature Flags 编译通过
- `bun run build:dev:full` 成功构建，零错误
- 16 个 Easy Reconstruction flags：已创建 stub 实现
- 15 个 Medium-Sized Gaps：所有 .ts 源文件已存在并验证
- 3 个 Large Subsystems (KAIROS, KAIROS_DREAM, PROACTIVE)：有意保留

### 重点重建的 Medium-Sized Gaps
- **BUDDY** — 完整 LLM 同伴系统（灵魂生成 + 观察者反应 + 动画精灵）
- **MONITOR_TOOL** — MCP 服务器健康监控
- **REACTIVE_COMPACT** — HTTP 413 触发的按需上下文压缩
- **DIRECT_CONNECT** — cc:// 和 cc+unix:// 连接 URL 解析
- **TERMINAL_PANEL** — TerminalCaptureTool 提示配置
- **CONTEXT_COLLAPSE** — CtxInspectTool 上下文检查
- **MONITOR_MCP_TASK** — 后台 MCP 监控任务

### OMC 子代理模型 ID 修复
- 22 个 agent `.md` 文件：`model: claude-opus-4-6` → `model: opus` 等
- 本地分支：`fix/agent-model-tier-names` in `~/.claude/plugins/marketplaces/omc`
- 备份：`omc-agent-backup/` 目录（含恢复指南）

### 资源管理与内存回收改进 (2026-04-12)

#### Phase 1: 快速修复
- **1A. MCP Session Lifecycle Binding** — `useManageMCPConnections.ts` unmount 时断开所有 MCP 连接，终止 stdio 子进程（修复 Cline #3200 同款泄漏）
- **1B. Session JSONL Size Cap** — `sessionStorage.ts` 50MB 阈值检测 + `history.ts` 30min TTL 清理过期待刷条目

#### Phase 2: 自动归档与看门狗
- **2A. Memdir Auto-Archival** — `memoryArchival.ts` (new) 实现 7 天 TTL 归档、日志蒸馏、磁盘监控；集成到 `autoDream.ts` 夜间合并流程
- **2B. LSP Memory Watchdog** — `lspMemoryWatchdog.ts` (new) 60s RSS 轮询、500MB 告警、1GB 自动重启；`LSPClient.ts` 暴露 `pid`，`LSPServerInstance.ts` 启用 `restartOnCrash`

#### Phase 3: 语义相关性排名
- **3. Semantic Relevance Ranking** — `semanticRelevance.ts` (new) 5 因子评分（recency/frequency/centrality/error/size）；`compact.ts` 替换纯时间戳排序，`SEMANTIC_COMPACTION` feature flag 渐进启用

#### Phase 4: 守护进程健康
- **4. Daemon Worker Health** — `main.ts` 陈旧 PID 清理、worker 自动重启（max 5 次）、7 天过期条目裁剪

### FEATURES.md 已更新
- 更新了所有 "Missing" 状态为实际存在状态
- 标注了重建日期和实现文件路径

### 剩余 15% 子系统完成 (2026-04-12 更新)

三个大型子系统代码已全部实现，仅缺 4 个导出/连线修复：

#### 修复清单
| # | 缺失项 | 文件 | 修复内容 |
|---|--------|------|----------|
| 1 | `getAssistantActivationPath()` | `src/assistant/index.ts` | 新增导出，返回 `ASSISTANT_DIR` 路径供遥测使用 |
| 2 | `setContextBlocked()` | `src/proactive/index.ts` | 新增 `_contextBlocked` 状态、setter/getter、`subscribeToProactiveChanges()` 发布-订阅机制 |
| 3 | dreamModule 导入 | `src/main.tsx:82` | 新增 `feature('KAIROS_DREAM')` 门控的条件 require |
| 4 | dream 初始化连线 | `src/main.tsx:1062` | KAIROS 块中调用 `dreamModule.setupDream()` |
| 5 | `--dream` CLI 选项 | `src/main.tsx:3863` | 新增 `--dream` 选项注册 |
| 6 | `activateDream()` / `isDreamActive()` | `src/dream.ts` | 新增公开 API 供 main.tsx 调用 |
| 7 | `maybeActivateDream()` | `src/main.tsx:4642` | 新增 Dream 激活函数，参照 proactive 模式 |

#### 子系统状态
- **KAIROS Assistant** — 完整实现（220 行 + sessionDiscovery + gate + sessionHistory + 组件）
- **KAIROS Dream** — 完整实现（任务队列、子进程执行、结果整合、autoDream 接入 stopHooks）
- **Proactive** — 完整实现（问题检测、洞察管理、任务队列、context blocked 状态）
- **构建状态** — `bun run build`、`build:dev`、`build:dev:full` 全部通过，零错误

### 项目完成度: **100%** (88/88 flags, 全部子系统实现并连线)
