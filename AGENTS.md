# arc-code AGENTS.md

## Essential Commands
- Interactive REPL: `./cli`
- One-shot mode: `./cli -p "your prompt"`
- Specify model: `./cli --model claude-opus-4-6`
- Run from source: `bun run dev`
- OAuth login: `./cli /login`

## Build Variants (Critical for Feature Flags)
- Production-like: `bun run build` → `./cli` (**All 38 experimental flags**)
- Dev build: `bun run build:dev` → `./cli-dev` (**All 38 experimental flags**)
- **Full experimental**: `bun run build:dev:full` → `./cli-dev` (same as above, alias)
- Custom flags: `bun run ./scripts/build.ts --feature=ULTRAPLAN --feature=ULTRATHINK`
- **Alternative output**: `bun run compile` → `./dist/cli` (**All 38 experimental flags**)

> Since v2.1.87+, all builds enable all 38 experimental feature flags by default.

## Special CLI Entry Points (Easy to Miss)
These flags are handled early in `src/entrypoints/cli.tsx` before loading full CLI:
- `./cli --version` / `-v` / `-V` (zero imports)
- `./cli --dump-system-prompt` (outputs rendered system prompt)
- `./cli --claude-in-chrome-mcp` (special MCP server)
- `./cli --chrome-native-host` (Chrome native host)
- `./cli --computer-use-mcp` (Computer Use MCP)
- `./cli --daemon-worker <kind>` (internal supervisor worker)
- `./cli remote-control` / `rc` / `remote` / `sync` / `bridge` (IDE bridge)
- `./cli daemon [subcommand]` (long-running supervisor)
- `./cli ps` / `logs` / `attach` / `kill` / `--bg` / `--background` (session mgmt)
- `./cli new` / `list` / `reply` (template jobs)
- `./cli environment-runner` (headless BYOC runner)
- `./cli self-hosted-runner` (headless self-hosted-runner)
- `./cli --tmux` + `--worktree` (exec into tmux before CLI)
- `./cli --update` / `--upgrade` (redirected to update subcommand)
- `./cli --bare` (sets CLAUDE_CODE_SIMPLE=1 early)

## Model Providers (Set via Env Vars)
- Anthropic (default): `ANTHROPIC_API_KEY` **or** OAuth via `./cli /login`
- OpenAI Codex: `export CLAUDE_CODE_USE_OPENAI=1`
- AWS Bedrock: `export CLAUDE_CODE_USE_BEDROCK=1` + AWS credentials
- Google Vertex AI: `export CLAUDE_CODE_USE_VERTEX=1`
- Anthropic Foundry: `export CLAUDE_CODE_USE_FOUNDRY=1` + `ANTHROPIC_FOUNDRY_API_KEY`

## Project Structure (Key Subsystems)
- Entry point: `src/entrypoints/cli.tsx`
- Agent SDK: `src/entrypoints/sdk/` (15 public APIs, 29 message types)
- Main UI: `src/screens/REPL.tsx` (Ink/React)
- Command registry: `src/commands.ts` → impl in `src/commands/`
- Tool registry: `src/tools.ts` → impl in `src/tools/`
- Query engine: `src/QueryEngine.ts`
- Core: `src/services/` (API, OAuth, MCP, analytics)
- State: `src/state/` (app state store)
- UI: `src/hooks/` (React), `src/components/` (Ink/React)
- Ext: `src/skills/` (skill system), `src/plugins/` (plugin system)
- Bridge: `src/bridge/` (IDE remote control)
- Voice: `src/voice/` (voice input)
- Tasks: `src/tasks/` (background task management)

## Key Notes
- **Bun >= 1.3.11** required (see package.json "engines")
- All telemetry stripped, guardrails removed, experimental features unlocked
- Uses TypeScript, React + Ink for terminal UI
- Feature flags controlled via `scripts/build.ts` (see FEATURES.md for full audit)
- **Windows only supported via WSL** (see README Requirements)
- Package bin aliases: `claude` and `claude-source` both point to `./cli`
- To run a single test or verification step: Check individual tool test files in `src/tools/*/testing/`
- LSP diagnostics can be run with `lsp_diagnostics` tool on changed files
- Feature flags are compile-time switches; rebuild required to change flags