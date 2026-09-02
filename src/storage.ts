import { readFile, writeFile } from "node:fs/promises";
import { emptyUsageStore, type UsageStore } from "./types.js";

export const STORAGE_FILENAME = ".token-usage.json";

export async function loadUsageStore(path: string): Promise<UsageStore> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as UsageStore;
    if (parsed.version !== 1) {
      throw new Error(
        `${path} has unsupported schema version ${String(parsed.version)}; expected 1`,
      );
    }
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyUsageStore();
    }
    throw err;
  }
}

export async function saveUsageStore(path: string, store: UsageStore): Promise<void> {
  const next: UsageStore = { ...store, updatedAt: new Date().toISOString() };
  await writeFile(path, JSON.stringify(next, null, 2) + "\n", "utf8");
}
