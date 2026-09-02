import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { claudeCodeAdapter } from "../src/adapters/claude-code.js";

function assistantLine(cwd: string, messageId: string, usage: Record<string, number>) {
  return JSON.stringify({
    type: "assistant",
    cwd,
    message: { id: messageId, usage },
  });
}

describe("claudeCodeAdapter", () => {
  let root: string;
  let projectsDir: string;
  let repoA: string;
  let repoB: string;
  let prevEnv: string | undefined;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "tokentrail-test-"));
    projectsDir = join(root, "projects");
    repoA = join(root, "repo-a");
    repoB = join(root, "repo-b");
    await mkdir(projectsDir, { recursive: true });
    prevEnv = process.env["TOKENTRAIL_CLAUDE_PROJECTS_DIR"];
    process.env["TOKENTRAIL_CLAUDE_PROJECTS_DIR"] = projectsDir;
  });

  afterEach(async () => {
    if (prevEnv === undefined) delete process.env["TOKENTRAIL_CLAUDE_PROJECTS_DIR"];
    else process.env["TOKENTRAIL_CLAUDE_PROJECTS_DIR"] = prevEnv;
    await rm(root, { recursive: true, force: true });
  });

  it("reports unavailable when there are no session files", async () => {
    expect(await claudeCodeAdapter.isAvailable()).toBe(false);
  });

  it("sums usage only for lines matching the target repo cwd", async () => {
    const sessionDir = join(projectsDir, "some-project");
    await mkdir(sessionDir, { recursive: true });
    const lines = [
      assistantLine(repoA, "msg-1", {
        input_tokens: 10,
        output_tokens: 20,
        cache_read_input_tokens: 5,
        cache_creation_input_tokens: 1,
      }),
      assistantLine(repoB, "msg-2", {
        input_tokens: 999,
        output_tokens: 999,
        cache_read_input_tokens: 999,
        cache_creation_input_tokens: 999,
      }),
      assistantLine(repoA, "msg-3", {
        input_tokens: 2,
        output_tokens: 3,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      }),
      JSON.stringify({ type: "user", cwd: repoA }), // non-assistant lines are ignored
    ].join("\n");
    await writeFile(join(sessionDir, "session1.jsonl"), lines, "utf8");

    expect(await claudeCodeAdapter.isAvailable()).toBe(true);
    const totals = await claudeCodeAdapter.collect(repoA);
    expect(totals).toEqual({ input: 12, output: 23, cacheRead: 5, cacheCreation: 1 });
  });

  it("dedupes messages with the same id across multiple session files", async () => {
    const sessionDir = join(projectsDir, "some-project");
    await mkdir(sessionDir, { recursive: true });
    const usage = {
      input_tokens: 10,
      output_tokens: 20,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    };
    await writeFile(join(sessionDir, "session1.jsonl"), assistantLine(repoA, "dup-msg", usage), "utf8");
    await writeFile(join(sessionDir, "session2.jsonl"), assistantLine(repoA, "dup-msg", usage), "utf8");

    const totals = await claudeCodeAdapter.collect(repoA);
    expect(totals).toEqual({ input: 10, output: 20, cacheRead: 0, cacheCreation: 0 });
  });

  it("tolerates malformed JSON lines without throwing", async () => {
    const sessionDir = join(projectsDir, "some-project");
    await mkdir(sessionDir, { recursive: true });
    const lines = ["not json{{{", assistantLine(repoA, "msg-1", { input_tokens: 5 })].join("\n");
    await writeFile(join(sessionDir, "session1.jsonl"), lines, "utf8");

    const totals = await claudeCodeAdapter.collect(repoA);
    expect(totals.input).toBe(5);
  });
});
