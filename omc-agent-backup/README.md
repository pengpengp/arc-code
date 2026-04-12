# OMC Agent Model Tier Fix Backup

Backup of 22 agent definition files with hardcoded Claude model IDs replaced by tier names.

## What was changed

| Before | After |
|--------|-------|
| `model: claude-opus-4-6` | `model: opus` |
| `model: claude-sonnet-4-6` | `model: sonnet` |
| `model: claude-haiku-4-5` | `model: haiku` |

## Why

When using non-Claude providers (AWS Bedrock, Google Vertex AI, custom base URLs),
the hardcoded Claude model IDs in agent frontmatter could cause 400 errors.
With tier names, OMC's `forceInherit` mode (auto-enabled for non-Claude providers)
makes agents inherit the parent model instead.

## How to restore after OMC update

```bash
# After updating OMC, copy these back
cp omc-agent-backup/agents/*.md \
  ~/.claude/plugins/marketplaces/omc/agents/

# Rebuild OMC
cd ~/.claude/plugins/marketplaces/omc
npm run build

# Sync to cache
cp agents/*.md \
  ~/.claude/plugins/cache/omc/oh-my-claudecode/4.6.7/agents/
cp dist/* \
  ~/.claude/plugins/cache/omc/oh-my-claudecode/4.6.7/dist/
```

## Original commit

`867fcf45` on branch `fix/agent-model-tier-names` in `~/.claude/plugins/marketplaces/omc/`
