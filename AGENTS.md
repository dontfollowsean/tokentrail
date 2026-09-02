# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Build/test: `npm run build` (tsc), `npm test` (vitest), `npm run dev -- <args>` (run CLI from source via tsx).
- Core types and the `LogAdapter` interface live in `src/types.ts`; new harness adapters implement that interface and register in `src/adapters/index.ts` — nothing else in core code should need to change.
- `.token-usage.json` is written by this tool into *adopting* repos, not this one. Its schema (`UsageStore`/`AgentUsage` in `src/types.ts`) splits `parsed` (rebuilt wholesale on every `scan`, safe to overwrite) from `manual` (only appended to by `add`) — don't collapse that distinction, `scan` depends on being able to fully recompute `parsed` from logs without touching `manual`.
- The Claude Code adapter (`src/adapters/claude-code.ts`) reads `~/.claude/projects/**/*.jsonl`; its directory root is overridable via `TOKENTRAIL_CLAUDE_PROJECTS_DIR` for tests — use that env var rather than touching `homedir()` in tests.
- The badge (`src/badge.ts`) renders a self-contained SVG with no external service (deliberate choice over shields.io endpoint-badges, see README "Badge setup").

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
