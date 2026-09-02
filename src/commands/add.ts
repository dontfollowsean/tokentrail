import { loadUsageStore, saveUsageStore, STORAGE_FILENAME } from "../storage.js";
import { addTokenCounts, emptyAgentUsage, emptyTokenCounts, tokenCountsTotal } from "../types.js";

export interface AddOptions {
  storagePath: string;
  agent: string;
  tokens: number;
  /** Free-text provider label (e.g. "anthropic", "openai"), stored for future cost estimation. Not validated against a fixed list since new providers appear often. */
  provider?: string;
  quiet?: boolean;
}

export async function runAdd(options: AddOptions): Promise<void> {
  if (!Number.isFinite(options.tokens) || options.tokens < 0) {
    throw new Error(`--tokens must be a non-negative number, got: ${options.tokens}`);
  }
  if (!options.agent) {
    throw new Error("--agent is required");
  }

  const store = await loadUsageStore(options.storagePath);
  const existing = store.agents[options.agent] ?? emptyAgentUsage();

  const delta = { ...emptyTokenCounts(), output: options.tokens };
  const manual = addTokenCounts(existing.manual, delta);

  store.agents[options.agent] = {
    ...existing,
    manual,
    total: tokenCountsTotal(existing.parsed) + tokenCountsTotal(manual),
    lastUpdated: new Date().toISOString(),
  };

  await saveUsageStore(options.storagePath, store);

  if (!options.quiet) {
    console.log(
      `added ${options.tokens.toLocaleString()} tokens for "${options.agent}"${
        options.provider ? ` (provider: ${options.provider})` : ""
      } -> ${STORAGE_FILENAME}`,
    );
  }
}
