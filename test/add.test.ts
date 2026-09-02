import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAdd } from "../src/commands/add.js";
import { loadUsageStore } from "../src/storage.js";

describe("runAdd", () => {
  let root: string;
  let storagePath: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "tokentrail-add-"));
    storagePath = join(root, ".token-usage.json");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("creates a new agent entry with the reported tokens", async () => {
    await runAdd({ storagePath, agent: "codex", tokens: 1500, quiet: true });
    const store = await loadUsageStore(storagePath);
    expect(store.agents["codex"]?.total).toBe(1500);
    expect(store.agents["codex"]?.manual.output).toBe(1500);
  });

  it("accumulates across multiple calls without clobbering", async () => {
    await runAdd({ storagePath, agent: "codex", tokens: 1000, quiet: true });
    await runAdd({ storagePath, agent: "codex", tokens: 500, quiet: true });
    const store = await loadUsageStore(storagePath);
    expect(store.agents["codex"]?.total).toBe(1500);
  });

  it("keeps agents independent", async () => {
    await runAdd({ storagePath, agent: "codex", tokens: 1000, quiet: true });
    await runAdd({ storagePath, agent: "cursor", tokens: 250, quiet: true });
    const store = await loadUsageStore(storagePath);
    expect(store.agents["codex"]?.total).toBe(1000);
    expect(store.agents["cursor"]?.total).toBe(250);
  });

  it("rejects negative token counts", async () => {
    await expect(runAdd({ storagePath, agent: "codex", tokens: -5, quiet: true })).rejects.toThrow(
      /non-negative/,
    );
  });
});
