import { loadUsageStore } from "../storage.js";

export interface ShowOptions {
  storagePath: string;
  json?: boolean;
}

export async function runShow(options: ShowOptions): Promise<void> {
  const store = await loadUsageStore(options.storagePath);

  if (options.json) {
    console.log(JSON.stringify(store, null, 2));
    return;
  }

  const agentIds = Object.keys(store.agents).sort();
  if (agentIds.length === 0) {
    console.log("No usage recorded yet. Run `tokentrail scan` or `tokentrail add`.");
    return;
  }

  const rows = agentIds.map((id) => {
    const usage = store.agents[id]!;
    return {
      agent: id,
      total: usage.total.toLocaleString(),
      parsed: usage.parsed
        ? (usage.parsed.input + usage.parsed.output + usage.parsed.cacheRead + usage.parsed.cacheCreation).toLocaleString()
        : "0",
      manual: usage.manual
        ? (usage.manual.input + usage.manual.output + usage.manual.cacheRead + usage.manual.cacheCreation).toLocaleString()
        : "0",
      lastUpdated: usage.lastUpdated,
    };
  });

  const widths = {
    agent: Math.max(5, ...rows.map((r) => r.agent.length)),
    total: Math.max(5, ...rows.map((r) => r.total.length)),
    parsed: Math.max(6, ...rows.map((r) => r.parsed.length)),
    manual: Math.max(6, ...rows.map((r) => r.manual.length)),
  };

  const header = `${"AGENT".padEnd(widths.agent)}  ${"TOTAL".padStart(widths.total)}  ${"PARSED".padStart(
    widths.parsed,
  )}  ${"MANUAL".padStart(widths.manual)}  LAST UPDATED`;
  console.log(header);
  for (const row of rows) {
    console.log(
      `${row.agent.padEnd(widths.agent)}  ${row.total.padStart(widths.total)}  ${row.parsed.padStart(
        widths.parsed,
      )}  ${row.manual.padStart(widths.manual)}  ${row.lastUpdated}`,
    );
  }
}
