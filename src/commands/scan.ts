import { adapters } from "../adapters/index.js";
import { loadUsageStore, saveUsageStore, STORAGE_FILENAME } from "../storage.js";
import { emptyAgentUsage, tokenCountsTotal } from "../types.js";

export interface ScanOptions {
  repoPath: string;
  storagePath: string;
  quiet?: boolean;
}

export async function runScan(options: ScanOptions): Promise<void> {
  const store = await loadUsageStore(options.storagePath);

  for (const adapter of adapters) {
    const available = await adapter.isAvailable();
    if (!available) {
      if (!options.quiet) {
        console.log(`skip  ${adapter.displayName}: no local logs found`);
      }
      continue;
    }

    const parsed = await adapter.collect(options.repoPath);
    const existing = store.agents[adapter.id] ?? emptyAgentUsage();
    const next = {
      ...existing,
      parsed,
      total: tokenCountsTotal(parsed) + tokenCountsTotal(existing.manual),
      lastUpdated: new Date().toISOString(),
    };
    store.agents[adapter.id] = next;

    if (!options.quiet) {
      console.log(`scan  ${adapter.displayName}: ${tokenCountsTotal(parsed).toLocaleString()} tokens`);
    }
  }

  await saveUsageStore(options.storagePath, store);
  if (!options.quiet) {
    console.log(`\nwrote ${STORAGE_FILENAME}`);
  }
}
