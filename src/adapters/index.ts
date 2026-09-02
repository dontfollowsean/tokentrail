import type { LogAdapter } from "../types.js";
import { claudeCodeAdapter } from "./claude-code.js";

/**
 * All built-in adapters. Add new harnesses here by implementing LogAdapter
 * and appending to this list — nothing else in core code needs to change.
 */
export const adapters: LogAdapter[] = [claudeCodeAdapter];

export function getAdapter(id: string): LogAdapter | undefined {
  return adapters.find((a) => a.id === id);
}
