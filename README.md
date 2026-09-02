# tokentrail

Track cumulative coding-agent token usage per repo, across any harness or provider (Claude Code, Codex,
Cursor, Grok, Kimi, etc.) — with a live badge on your README.

`tokentrail` collects token counts two ways — parsing local agent logs automatically, or accepting a manual
report from any agent, hook, or human — and stores the running total in a small JSON file you commit to your
repo. A GitHub Action turns that file into a self-contained SVG badge, no external badge service required.

```
tokentrail | claude-code 128k | codex 42k
```

## Install

```sh
npx tokentrail --help
```

Or install it as a dev dependency:

```sh
npm install --save-dev tokentrail
```

## Quick start

1. From the root of your repo, scan for local Claude Code session logs and build `.token-usage.json`:

   ```sh
   npx tokentrail scan
   ```

2. For agents with no parseable local log yet, report usage manually:

   ```sh
   npx tokentrail add --agent codex --tokens 4200 --provider openai
   ```

3. Commit `.token-usage.json` to your repo. It's the source of truth both collection paths write to.

4. Wire up the [badge GitHub Action](#badge-setup) so your README shows live, cumulative totals.

## Commands

### `tokentrail scan`

Parses local session/transcript logs for every supported agent and rebuilds the *parsed* portion of
`.token-usage.json` from scratch. Safe to re-run — it recomputes totals from your logs rather than
accumulating deltas, so running it twice in a row does not double-count anything. Manual totals recorded via
`tokentrail add` are untouched by scan and are added on top.

```sh
tokentrail scan [--repo <path>] [--storage <path>]
```

- `--repo <path>` — repo to attribute usage to (default: current directory). Log adapters filter their
  source logs down to entries recorded while working in this path.
- `--storage <path>` — path to the usage file (default: `<repo>/.token-usage.json`).

v1 ships one adapter: **Claude Code**, which reads `~/.claude/projects/**/*.jsonl` transcripts and sums the
`usage` block the Anthropic Messages API attaches to each assistant turn (input, output, and cache
read/creation tokens). See [Adapters](#adapters) for how to add another harness.

### `tokentrail add`

The fallback collection path — for any harness, CI hook, or human that has no parseable local log to scan.
Adds to a running manual total per agent; does not overwrite it.

```sh
tokentrail add --agent <name> --tokens <n> [--provider <name>] [--repo <path>] [--storage <path>]
```

- `--agent <name>` — agent identifier, e.g. `codex`, `cursor`, `claude-code`. Free-form; not validated
  against a fixed list, since new harnesses show up faster than this tool can track them.
- `--tokens <n>` — token count to add (non-negative integer).
- `--provider <name>` — optional provider label (e.g. `anthropic`, `openai`), recorded for a possible future
  cost-estimate feature. Not used for anything in v1.
- `--repo <path>` — repo the usage file lives in (default: current directory). Only used to resolve the
  default `--storage` path; ignored if `--storage` is passed explicitly.
- `--storage <path>` — path to the usage file (default: `<repo>/.token-usage.json`).

### `tokentrail show`

Prints a summary table of `.token-usage.json`. Pass `--json` for the raw file contents.

```sh
tokentrail show [--repo <path>] [--storage <path>] [--json]
```

### `tokentrail badge`

Renders a self-contained SVG badge from `.token-usage.json`. This is what the GitHub Action below calls; you
can also run it locally to preview the badge.

```sh
tokentrail badge [--repo <path>] [--storage <path>] [--out <path>]
```

## Storage: `.token-usage.json`

A small file committed to your repo (not to this tool's own repo — every adopting project gets its own
copy). Both collection paths write to it; the badge action reads from it.

```json
{
  "version": 1,
  "agents": {
    "claude-code": {
      "parsed": { "input": 812345, "output": 203981, "cacheRead": 4213000, "cacheCreation": 91200 },
      "manual": { "input": 0, "output": 0, "cacheRead": 0, "cacheCreation": 0 },
      "total": 5320526,
      "costUsd": null,
      "lastUpdated": "2026-08-30T12:04:11.000Z"
    },
    "codex": {
      "parsed": { "input": 0, "output": 0, "cacheRead": 0, "cacheCreation": 0 },
      "manual": { "input": 0, "output": 42000, "cacheRead": 0, "cacheCreation": 0 },
      "total": 42000,
      "costUsd": null,
      "lastUpdated": "2026-08-30T09:15:02.000Z"
    }
  },
  "updatedAt": "2026-08-30T12:04:11.000Z"
}
```

- `parsed` — totals rebuilt wholesale on every `scan`, by re-reading all discoverable local logs. Never
  hand-edit this; it will be overwritten.
- `manual` — totals accumulated only via `add`. Scan never touches this.
- `total` — `parsed` + `manual`, kept denormalized for easy badge/report reads.
- `costUsd` — reserved for a future cost-estimate feature. **v1 does not populate this** (see
  [Non-goals](#non-goals)); it's here so the schema won't need a breaking change later.

Commit this file. It's small, diffs cleanly, and is the only state tokentrail needs.

## Badge setup

The badge is a self-contained SVG generated locally by `tokentrail badge` — no shields.io or other external
rendering service involved, so it keeps working even if a third-party badge host goes down or blocks your
repo's traffic.

1. Copy [`.github/workflows/tokentrail-badge.yml`](.github/workflows/tokentrail-badge.yml) from this repo
   into your own repo at the same path.
2. Make sure `.token-usage.json` is committed (see [Quick start](#quick-start)).
3. Add the badge to your README:

   ```markdown
   ![token usage](./tokentrail-badge.svg)
   ```

4. On every push to `main` that touches `.token-usage.json`, the workflow regenerates
   `tokentrail-badge.svg` and commits it back if it changed.

You still need something to keep `.token-usage.json` itself up to date — run `tokentrail scan` locally (or
in a pre-commit hook) before pushing, or have your agent/CI call `tokentrail add` as it works.

## Adapters

Log parsing is pluggable so other harnesses (Codex, Cursor, etc.) can be added without touching core logic.
An adapter implements the `LogAdapter` interface in [`src/types.ts`](src/types.ts):

```ts
interface LogAdapter {
  id: string; // e.g. "codex" — becomes the agent key in .token-usage.json
  displayName: string;
  isAvailable(): Promise<boolean>; // does this machine have any logs for this harness at all?
  collect(repoPath: string): Promise<TokenCounts>; // aggregate usage for one repo
}
```

v1 ships one adapter — [`src/adapters/claude-code.ts`](src/adapters/claude-code.ts) — because it's the only
log format we could verify against real session files. Adapters for other harnesses are welcome as PRs once
someone has a verified log format to parse; register a new adapter by adding it to the list in
[`src/adapters/index.ts`](src/adapters/index.ts).

## Non-goals

Out of scope for v1, deliberately:

- **Billing-API integration.** There's no reliable way to attribute a provider's billed usage back to a
  single repo, so tokentrail only reads what's on disk locally.
- **A hosted dashboard.** Everything here is local-first: a JSON file in your repo and a badge rendered by
  your own CI.
- **Cost estimation in dollars.** Providers price differently and change pricing often; without billing-API
  integration (itself out of scope) any dollar figure here would be a guess dressed up as data. `costUsd` is
  reserved in the schema for if/when that becomes reliable enough to add.

## Contributing

Issues and PRs welcome, especially new log adapters with a verified real-world log format to test against.

```sh
npm install
npm run build    # compile TypeScript to dist/
npm test         # run the test suite
npm run dev      # run the CLI from source via tsx, e.g. `npm run dev -- show`
```

## License

MIT — see [LICENSE](LICENSE).
