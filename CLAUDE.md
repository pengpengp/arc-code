# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common commands

```bash
# Install dependencies
bun install

# Standard build (./cli)
bun run build

# Dev build (./cli-dev)
bun run build:dev

# Dev build with all experimental features (./cli-dev)
bun run build:dev:full

# Compiled build (./dist/cli)
bun run compile

# Run from source without compiling
bun run dev
```

Run the built binary with `./cli` or `./cli-dev`. Set `ANTHROPIC_API_KEY` in the environment or use OAuth via `./cli /login`.

## High-level architecture

- **Entry point/UI loop**: src/entrypoints/cli.tsx bootstraps the CLI, with the main interactive UI in src/screens/REPL.tsx (Ink/React).
- **Command/tool registries**: src/commands.ts registers slash commands; src/tools.ts registers tool implementations. Implementations live in src/commands/ and src/tools/.
- **LLM query pipeline**: src/QueryEngine.ts coordinates message flow, tool use, and model invocation.
- **Core subsystems**:
  - src/services/: API clients, OAuth/MCP integration, analytics stubs
  - src/state/: app state store
  - src/hooks/: React hooks used by UI/flows
  - src/components/: terminal UI components (Ink)
  - src/skills/: skill system
  - src/plugins/: plugin system
  - src/bridge/: IDE bridge
  - src/voice/: voice input
  - src/tasks/: background task management

### KAIROS Subsystem (Active)

Three experimental subsystems are fully enabled in `bun run build:dev:full`:

- **KAIROS** (Persistent Assistant): Cross-session memory via `src/memdir/`, assistant state in `src/assistant/`. Activated by `setKairosActive(true)` in `src/main.tsx`.
- **KAIROS_DREAM** (Background Autonomous Tasks): Claude works on tasks independently. Entry point `src/dream.ts`.
- **PROACTIVE** (Proactive Issue Detection): Entry point `src/proactive/`. GrowthBook gates bypassed for non-ant builds.

## Build system

- scripts/build.ts is the build script and feature-flag bundler. Feature flags are set via build arguments (e.g., `--feature=ULTRAPLAN`) or presets like `--feature-set=dev-full`.
- Feature flags are resolved at compile time via `bun:bundle` — dead code elimination removes unused branches. See `src/utils/feature.ts` for the `feature()` function.
- Build artifacts (`cli`, `cli-dev.*`, `*.bun-build`) are gitignored.

## Special CLI entry points

Handled early in `src/entrypoints/cli.tsx` before loading full CLI:

- `./cli --version` / `-v` / `-V` (zero imports)
- `./cli --dump-system-prompt` (outputs rendered system prompt)
- `./cli --daemon-worker <kind>` (internal supervisor worker)
- `./cli remote-control` / `rc` / `remote` / `sync` / `bridge` (IDE bridge)
- `./cli daemon [subcommand]` (long-running supervisor)
- `./cli ps` / `logs` / `attach` / `kill` / `--bg` / `--background` (session mgmt)
- `./cli --update` / `--upgrade` (redirected to update subcommand)
- `./cli --bare` (sets CLAUDE_CODE_SIMPLE=1 early)

## Important notes

- **No test infrastructure**: This project has zero test files and zero test runners. Avoid changes that would benefit from tests unless you add testing infrastructure first.
- **TypeScript strict mode**: Currently `strict: false` — enabling it produces ~7748 errors. Do not attempt without a phased migration plan.
- **All source is TypeScript**: Zero `.js` files should remain in `src/`. If you find any, migrate them to `.ts`/`.tsx`.
- **Dead commands**: Many command stubs have been removed from src/commands.ts. Do not re-add registrations unless the implementation exists.
- **FEATURES.md**: Refer to this file for the complete audit of all 88 feature flags.
- **Windows EPERM**: `cli-dev.exe` file locks during active processes cause build errors — this is a Windows file lock issue, not a compilation failure. 5632 modules bundle successfully.
- **Package bin aliases**: `claude` and `claude-source` both point to `./cli` in package.json.

## Supported model providers

Set environment variables to switch providers:

| Provider | Env Variable | Auth |
|---|---|---|
| Anthropic (default) | — | `ANTHROPIC_API_KEY` or OAuth |
| OpenAI Codex | `CLAUDE_CODE_USE_OPENAI=1` | OAuth via OpenAI |
| AWS Bedrock | `CLAUDE_CODE_USE_BEDROCK=1` | AWS credentials |
| Google Vertex AI | `CLAUDE_CODE_USE_VERTEX=1` | `gcloud` ADC |
| Anthropic Foundry | `CLAUDE_CODE_USE_FOUNDRY=1` | `ANTHROPIC_FOUNDRY_API_KEY` |
