/** Raw token counts for a single unit of usage (one message, one manual report, etc). */
export interface TokenCounts {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
}

export function emptyTokenCounts(): TokenCounts {
  return { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
}

export function tokenCountsTotal(counts: TokenCounts): number {
  return counts.input + counts.output + counts.cacheRead + counts.cacheCreation;
}

export function addTokenCounts(a: TokenCounts, b: TokenCounts): TokenCounts {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheCreation: a.cacheCreation + b.cacheCreation,
  };
}

/** Per-agent usage stored in .token-usage.json. */
export interface AgentUsage {
  /**
   * Totals rebuilt from scratch on every `tokentrail scan` by re-reading all
   * discoverable local logs for this agent. Safe to overwrite wholesale.
   */
  parsed: TokenCounts;
  /**
   * Totals accumulated only via `tokentrail add` (manual/CLI reports), for
   * harnesses or environments with no parseable local log. Never recomputed
   * by scan, only appended to.
   */
  manual: TokenCounts;
  /** parsed total + manual total, kept denormalized for easy badge/report reads. */
  total: number;
  /**
   * Reserved for a future cost-estimate feature. v1 does not populate this;
   * it exists so the schema doesn't need a breaking change later.
   */
  costUsd: number | null;
  lastUpdated: string;
}

/** Shape of the committed .token-usage.json file. */
export interface UsageStore {
  /** Schema version, bumped on breaking changes to this shape. */
  version: 1;
  agents: Record<string, AgentUsage>;
  updatedAt: string;
}

export function emptyAgentUsage(): AgentUsage {
  return {
    parsed: emptyTokenCounts(),
    manual: emptyTokenCounts(),
    total: 0,
    costUsd: null,
    lastUpdated: new Date(0).toISOString(),
  };
}

export function emptyUsageStore(): UsageStore {
  return {
    version: 1,
    agents: {},
    updatedAt: new Date(0).toISOString(),
  };
}

/**
 * One adapter per coding-agent harness. Adapters read whatever local
 * session/transcript logs that harness writes and return aggregate token
 * counts for a given repo path. They must not mutate the usage store
 * themselves — the scan command owns merging results into storage.
 */
export interface LogAdapter {
  /** Stable identifier used as the agent key in .token-usage.json, e.g. "claude-code". */
  id: string;
  /** Human-readable name for CLI output, e.g. "Claude Code". */
  displayName: string;
  /**
   * Returns true if this adapter has any local logs to read at all
   * (independent of whether they mention the target repo). Used to skip
   * adapters cleanly on machines that never ran that harness.
   */
  isAvailable(): Promise<boolean>;
  /** Aggregate token usage for `repoPath` across all local logs this adapter can find. */
  collect(repoPath: string): Promise<TokenCounts>;
}
