#!/usr/bin/env node
import { Command } from "commander";
import { resolve } from "node:path";
import { runAdd } from "./commands/add.js";
import { runBadge } from "./commands/badge.js";
import { runScan } from "./commands/scan.js";
import { runShow } from "./commands/show.js";
import { STORAGE_FILENAME } from "./storage.js";

const program = new Command();

program
  .name("tokentrail")
  .description("Track cumulative coding-agent token usage per repo, with a live README badge.")
  .version("0.1.0");

program
  .command("scan")
  .description(
    `Parse local session logs for known agents (currently: Claude Code) and rebuild parsed totals in ${STORAGE_FILENAME}.`,
  )
  .option("--repo <path>", "repo path to attribute usage to", process.cwd())
  .option("--storage <path>", `path to the usage file (default: <repo>/${STORAGE_FILENAME})`)
  .option("--quiet", "suppress output", false)
  .action(async (opts: { repo: string; storage?: string; quiet: boolean }) => {
    const repoPath = resolve(opts.repo);
    await runScan({
      repoPath,
      storagePath: resolve(opts.storage ?? `${repoPath}/${STORAGE_FILENAME}`),
      quiet: opts.quiet,
    });
  });

program
  .command("add")
  .description("Manually record token usage for an agent that has no parseable local log (fallback path).")
  .requiredOption("--agent <name>", "agent identifier, e.g. codex, cursor, claude-code")
  .requiredOption("--tokens <n>", "number of tokens to add", (v) => Number(v))
  .option("--provider <name>", "provider label (e.g. anthropic, openai) recorded for future cost estimation")
  .option("--repo <path>", "repo path the usage file lives in (used to resolve the default --storage)", process.cwd())
  .option("--storage <path>", `path to the usage file (default: <repo>/${STORAGE_FILENAME})`)
  .option("--quiet", "suppress output", false)
  .action(
    async (opts: { agent: string; tokens: number; provider?: string; repo: string; storage?: string; quiet: boolean }) => {
      await runAdd({
        agent: opts.agent,
        tokens: opts.tokens,
        provider: opts.provider,
        storagePath: resolve(opts.storage ?? `${resolve(opts.repo)}/${STORAGE_FILENAME}`),
        quiet: opts.quiet,
      });
    },
  );

program
  .command("show")
  .description(`Print a summary of ${STORAGE_FILENAME}.`)
  .option("--repo <path>", "repo path the usage file lives in (used to resolve the default --storage)", process.cwd())
  .option("--storage <path>", `path to the usage file (default: <repo>/${STORAGE_FILENAME})`)
  .option("--json", "print raw JSON instead of a table", false)
  .action(async (opts: { repo: string; storage?: string; json: boolean }) => {
    await runShow({
      storagePath: resolve(opts.storage ?? `${resolve(opts.repo)}/${STORAGE_FILENAME}`),
      json: opts.json,
    });
  });

program
  .command("badge")
  .description(`Render a self-contained SVG badge from ${STORAGE_FILENAME} (used by the tokentrail GitHub Action).`)
  .option("--repo <path>", "repo path the usage file lives in (used to resolve the default --storage)", process.cwd())
  .option("--storage <path>", `path to the usage file (default: <repo>/${STORAGE_FILENAME})`)
  .option("--out <path>", "output SVG path", "./tokentrail-badge.svg")
  .option("--quiet", "suppress output", false)
  .action(async (opts: { repo: string; storage?: string; out: string; quiet: boolean }) => {
    await runBadge({
      storagePath: resolve(opts.storage ?? `${resolve(opts.repo)}/${STORAGE_FILENAME}`),
      outPath: resolve(opts.out),
      quiet: opts.quiet,
    });
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(`tokentrail: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
