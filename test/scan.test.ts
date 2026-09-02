import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runScan } from "../src/commands/scan.js";
import { loadUsageStore } from "../src/storage.js";

describe("runScan", () => {
  let root: string;
  let projectsDir: string;
  let repoPath: string;
  let storagePath: string;
  let prevEnv: string | undefined;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "tokentrail-scan-"));
    projectsDir = join(root, "projects");
    repoPath = join(root, "repo");
    storagePath = join(repoPath, ".token-usage.json");
    await mkdir(projectsDir, { recursive: true });
    await mkdir(repoPath, { recursive: true });
    prevEnv = process.env["TOKENTRAIL_CLAUDE_PROJECTS_DIR"];
    process.env["TOKENTRAIL_CLAUDE_PROJECTS_DIR"] = projectsDir;
  });

  afterEach(async () => {
    if (prevEnv === undefined) delete process.env["TOKENTRAIL_CLAUDE_PROJECTS_DIR"];
    else process.env["TOKENTRAIL_CLAUDE_PROJECTS_DIR"] = prevEnv;
    await rm(root, { recursive: true, force: true });
  });

  it("writes parsed totals from claude-code logs into the storage file", async () => {
    const sessionDir = join(projectsDir, "some-project");
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, "session1.jsonl"),
      JSON.stringify({
        type: "assistant",
        cwd: repoPath,
        message: { id: "msg-1", usage: { input_tokens: 100, output_tokens: 50 } },
      }),
      "utf8",
    );

    await runScan({ repoPath, storagePath, quiet: true });

    const store = await loadUsageStore(storagePath);
    expect(store.agents["claude-code"]?.total).toBe(150);
  });

  it("is idempotent: re-running scan does not double totals", async () => {
    const sessionDir = join(projectsDir, "some-project");
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, "session1.jsonl"),
      JSON.stringify({
        type: "assistant",
        cwd: repoPath,
        message: { id: "msg-1", usage: { input_tokens: 100, output_tokens: 50 } },
      }),
      "utf8",
    );

    await runScan({ repoPath, storagePath, quiet: true });
    await runScan({ repoPath, storagePath, quiet: true });

    const store = await loadUsageStore(storagePath);
    expect(store.agents["claude-code"]?.total).toBe(150);
  });

  it("preserves manually-added totals from `add` across a scan", async () => {
    const { runAdd } = await import("../src/commands/add.js");
    await runAdd({ storagePath, agent: "claude-code", tokens: 999, quiet: true });

    const sessionDir = join(projectsDir, "some-project");
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, "session1.jsonl"),
      JSON.stringify({
        type: "assistant",
        cwd: repoPath,
        message: { id: "msg-1", usage: { input_tokens: 100, output_tokens: 50 } },
      }),
      "utf8",
    );

    await runScan({ repoPath, storagePath, quiet: true });

    const store = await loadUsageStore(storagePath);
    expect(store.agents["claude-code"]?.total).toBe(150 + 999);
  });
});
