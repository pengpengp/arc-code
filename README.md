```
   ___                              ____  _
  / _ \ _ __ ___   __ _  ___ ___   / ___|| |_ ___  _ __ __ _  ___
 | | | | '__/ _ \ / _` |/ __/ _ \  \___ \| __/ _ \| '__/ _` |/ _ \
 | |_| | | | (_) | (_| | (_|  __/   ___) | || (_) | | | (_| |  __/
  \___/|_|  \___/ \__,_|\___\___|  |____/ \__\___/|_|  \__,_|\___|
```

# arc-code

> AI-native terminal for autonomous development. Multi-agent orchestration, proactive assistance, and deep code intelligence — all in one CLI.

---

## Overview

arc-code is an enhanced AI-powered development terminal that combines five subsystems into a single cohesive experience:

**1. AI Code Generation** — Full LLM-powered code editing, file operations, Bash execution, and git workflows through a reactive terminal UI. Supports Anthropic, OpenAI Codex, AWS Bedrock, Google Vertex AI, and Anthropic Foundry.

**2. KAIROS Assistant** — Persistent AI assistant with cross-session memory. Remembers previous conversations, tracks decisions and tasks, and maintains context between sessions.

**3. KAIROS Dream** — Background autonomous task execution. Claude can work on tasks independently while you focus on other things.

**4. Proactive Mode** — Claude detects issues and opportunities without being asked: uncommitted changes, stale dependencies, build errors, test failures, and suggests improvements autonomously.

**5. Agent Swarms** — Multi-agent coordination with specialized agents for architecture, debugging, code review, testing, and planning. Agents can be triggered by events, schedules, or manually.

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/pengpengp/arc-code/main/install.sh | bash
```

Or build from source:

```bash
git clone https://github.com/pengpengp/arc-code.git
cd arc-code
bun install
bun run build:dev:full
```

Then run `./cli-dev` (or `./cli` for production-like build).

---

## Table of Contents

- [Core Features](#core-features)
- [Model Providers](#model-providers)
- [Build System](#build-system)
- [Usage](#usage)
- [Experimental Features](#experimental-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)

---

## Core Features

### AI Code Terminal

Interactive REPL powered by React + Ink. Claude can read/write files, run Bash commands, execute git operations, search code with ripgrep, and integrate with MCP servers — all through a permission-aware interface.

### KAIROS Persistent Assistant

Cross-session memory that tracks conversations, decisions, and tasks. Ask about previous work and get relevant context automatically.

```bash
./cli-dev --assistant   # Enable assistant mode
./cli-dev               # Auto-enabled for arc-code builds
```

### Dream Mode — Background Autonomy

Claude works on tasks independently in the background. Trigger via natural language or let the proactive system identify opportunities.

```bash
# Claude will work on identified tasks while you do other things
```

### Proactive Assistance

Claude detects and surfaces issues without prompting:

- Uncommitted changes提醒
- Stale dependency detection
- Build error identification
- Code improvement suggestions
- Test failure analysis

### Multi-Agent Orchestration

Specialized agents for different tasks:

| Agent | Model | Purpose |
|---|---|---|
| analyst | Opus | Requirements analysis |
| architect | Opus | System architecture design |
| planner | Opus | Task breakdown and planning |
| debugger | Sonnet | Root cause analysis |
| executor | Sonnet | Implementation work |
| verifier | Sonnet | Verification and validation |
| code-reviewer | Opus | Code quality review |
| test-engineer | Sonnet | Test coverage |
| git-master | Sonnet | Git operations |
| security-reviewer | Sonnet | Security audit |

---

## Model Providers

Five providers supported out of the box:

| Provider | Env Variable | Auth |
|---|---|---|
| Anthropic (default) | — | `ANTHROPIC_API_KEY` or OAuth |
| OpenAI Codex | `CLAUDE_CODE_USE_OPENAI=1` | OAuth via OpenAI |
| AWS Bedrock | `CLAUDE_CODE_USE_BEDROCK=1` | AWS credentials |
| Google Vertex AI | `CLAUDE_CODE_USE_VERTEX=1` | `gcloud` ADC |
| Anthropic Foundry | `CLAUDE_CODE_USE_FOUNDRY=1` | `ANTHROPIC_FOUNDRY_API_KEY` |

Available models:

| Model | ID |
|---|---|
| Claude Opus 4.6 | `claude-opus-4-6` |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` |
| Claude Haiku 4.5 | `claude-haiku-4-5` |
| GPT-5.3 Codex | `gpt-5.3-codex` |
| GPT-5.4 | `gpt-5.4` |
| GPT-5.4 Mini | `gpt-5.4-mini` |

---

## Build System

Feature flags are set at compile time via `bun:bundle` — dead code elimination removes unused branches.

| Command | Output | Features |
|---|---|---|
| `bun run build` | `./cli` | VOICE_MODE only |
| `bun run build:dev` | `./cli-dev` | VOICE_MODE only |
| `bun run build:dev:full` | `./cli-dev` | All 54 experimental flags |
| `bun run compile` | `./dist/cli` | VOICE_MODE only |

Custom flags:

```bash
bun run ./scripts/build.ts --feature=ULTRAPLAN --feature=ULTRATHINK
bun run ./scripts/build.ts --dev --feature=BRIDGE_MODE
```

---

## Usage

```bash
# Interactive REPL
./cli-dev

# One-shot mode
./cli-dev -p "explain this codebase"

# Specify model
./cli-dev --model claude-opus-4-6

# Run from source
bun run dev

# With assistant mode
./cli-dev --assistant
```

### Key Commands

```
/help           Show available commands
/login          OAuth authentication
/commit         Create git commit
/review-pr      Review a pull request
/compact        Compact conversation context
/clear          Clear screen and context
```

### Environment Variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `ANTHROPIC_MODEL` | Override default model |
| `ANTHROPIC_BASE_URL` | Custom API endpoint |
| `CLAUDE_CODE_USE_OPENAI` | Enable OpenAI provider |
| `CLAUDE_CODE_USE_BEDROCK` | Enable Bedrock provider |
| `CLAUDE_CODE_USE_VERTEX` | Enable Vertex AI |
| `CLAUDE_CODE_USE_FOUNDRY` | Enable Foundry |

---

## Experimental Features

88 feature flags total, 54 working and enabled in `build:dev:full`:

### Interaction & UI

| Flag | Description |
|---|---|
| `ULTRAPLAN` | Remote multi-agent planning (Opus-class) |
| `ULTRATHINK` | Deep reasoning mode |
| `VOICE_MODE` | Push-to-talk voice input |
| `TOKEN_BUDGET` | Token budget tracking |
| `HISTORY_PICKER` | Prompt history picker |
| `MESSAGE_ACTIONS` | Message action entrypoints |
| `QUICK_SEARCH` | Prompt quick-search |
| `MCP_RICH_OUTPUT` | Rich MCP output rendering |
| `NATIVE_CLIPBOARD_IMAGE` | Image paste from clipboard |
| `POWERSHELL_AUTO_MODE` | PowerShell integration |

### KAIROS Subsystem

| Flag | Description |
|---|---|
| `KAIROS` | Persistent assistant mode |
| `KAIROS_BRIEF` | Brief mode for assistant |
| `KAIROS_CHANNELS` | Multi-channel assistant |
| `KAIROS_DREAM` | Background autonomous tasks |
| `PROACTIVE` | Proactive issue detection |

### Agents & Memory

| Flag | Description |
|---|---|
| `AGENT_MEMORY_SNAPSHOT` | Agent memory persistence |
| `AGENT_TRIGGERS` | Local cron/trigger tools |
| `AGENT_TRIGGERS_REMOTE` | Remote trigger support |
| `BUILTIN_EXPLORE_PLAN_AGENTS` | Explore/plan agent presets |
| `VERIFICATION_AGENT` | Verification agent |
| `EXTRACT_MEMORIES` | Auto memory extraction |
| `COMPACTION_REMINDERS` | Context compaction reminders |
| `CACHED_MICROCOMPACT` | Cached microcompact state |
| `TEAMMEM` | Team memory files |
| `LODESTONE` | Lodestone agent framework |

### Tools & Infrastructure

| Flag | Description |
|---|---|
| `BRIDGE_MODE` | IDE remote-control bridge |
| `BASH_CLASSIFIER` | Bash permission classifier |
| `CONNECTOR_TEXT` | Connector text features |
| `CCR_AUTO_CONNECT` | Auto-connect CCR |
| `CCR_MIRROR` | CCR mirror mode |
| `CCR_REMOTE_SETUP` | Remote CCR setup |
| `HOOK_PROMPTS` | Hook prompt customization |
| `MESSAGE_ACTIONS` | Message actions |
| `NEW_INIT` | New initialization system |
| `SHOT_STATS` | Shot distribution stats |
| `TREE_SITTER_BASH` | Tree-sitter bash parsing |
| `VOICE_MODE` | Voice input support |
| `AWAY_SUMMARY` | Away mode summary |

See [FEATURES.md](FEATURES.md) for the complete audit of all 88 flags.

---

## Architecture

```
src/
  entrypoints/cli.tsx     # CLI entry + bootstrap
  main.tsx                # Main app initialization
  commands.ts             # Slash command registry
  tools.ts                # Agent tool registry
  QueryEngine.ts          # LLM query pipeline
  screens/REPL.tsx        # Main UI (Ink/React, 5009 lines)

  assistant/              # KAIROS assistant subsystem
    gate.ts               # Feature gate (GrowthBook bypass)
    index.ts              # Assistant mode entry
    sessionDiscovery.ts   # Session discovery
  proactive/              # Proactive mode
    index.ts              # Proactive engine
    useProactive.ts       # React hook
  dream.ts                # Dream mode (background tasks)
  memdir/                 # Cross-session memory
  utils/swarm/            # Multi-agent orchestration

  commands/               # Command implementations
  tools/                  # Tool implementations
  components/             # Ink/React UI components
  services/               # API, MCP, OAuth, analytics
  hooks/                  # React hooks
  state/                  # App state store
  skills/                 # Skill system
  plugins/                # Plugin system
  bridge/                 # IDE bridge
  voice/                  # Voice input
  tasks/                  # Background task management
```

### Key Design Decisions

- **Compile-time feature flags**: Flags are resolved at build time via `bun:bundle`, enabling dead code elimination. See `scripts/build.ts` and `src/utils/feature.ts`.
- **GrowthBook bypass**: Non-ant builds bypass remote feature gates locally, allowing all experimental features to activate.
- **KAIROS state latch**: `setKairosActive(true)` must be called at startup for KAIROS subsystem to activate — handled in `main.tsx`.
- **100% TypeScript**: Zero `.js` files in source. All migrated during quality improvement pass.

---

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) >= 1.3.11 |
| Language | TypeScript |
| Terminal UI | React + [Ink](https://github.com/vadimdemedes/ink) |
| CLI Parsing | [Commander.js](https://github.com/tj/commander.js) |
| Schema Validation | Zod v4 |
| Code Search | ripgrep (bundled) |
| Protocols | MCP, LSP |
| APIs | Anthropic, OpenAI Codex, AWS Bedrock, Google Vertex AI |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

For experimental feature development, use `bun run build:dev:full` to test with all flags enabled.

---

## License

The original Claude Code source is the property of Anthropic. This fork exists because the source was publicly exposed through their npm distribution. arc-code applies telemetry removal, guardrail stripping, and experimental feature activation on top. Use at your own discretion.
