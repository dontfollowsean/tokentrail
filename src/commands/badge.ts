import { writeFile } from "node:fs/promises";
import { renderBadgeSvg } from "../badge.js";
import { loadUsageStore } from "../storage.js";

export interface BadgeOptions {
  storagePath: string;
  outPath: string;
  quiet?: boolean;
}

export async function runBadge(options: BadgeOptions): Promise<void> {
  const store = await loadUsageStore(options.storagePath);
  const svg = renderBadgeSvg(store);
  await writeFile(options.outPath, svg, "utf8");
  if (!options.quiet) {
    console.log(`wrote ${options.outPath}`);
  }
}
