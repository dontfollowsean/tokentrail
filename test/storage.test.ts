import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadUsageStore, saveUsageStore } from "../src/storage.js";
import { emptyAgentUsage } from "../src/types.js";

describe("storage", () => {
  let root: string;
  let storagePath: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "tokentrail-storage-"));
    storagePath = join(root, ".token-usage.json");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("returns an empty store when the file does not exist", async () => {
    const store = await loadUsageStore(storagePath);
    expect(store.agents).toEqual({});
    expect(store.version).toBe(1);
  });

  it("round-trips a store through save and load", async () => {
    const store = await loadUsageStore(storagePath);
    store.agents["claude-code"] = { ...emptyAgentUsage(), total: 42 };
    await saveUsageStore(storagePath, store);

    const reloaded = await loadUsageStore(storagePath);
    expect(reloaded.agents["claude-code"]?.total).toBe(42);
  });

  it("rejects a file with an unsupported schema version", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(storagePath, JSON.stringify({ version: 2, agents: {} }), "utf8");
    await expect(loadUsageStore(storagePath)).rejects.toThrow(/unsupported schema version/);
  });
});
