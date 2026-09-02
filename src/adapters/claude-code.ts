import { createInterface } from "node:readline";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { addTokenCounts, emptyTokenCounts, type LogAdapter, type TokenCounts } from "../types.js";

/**
 * Claude Code writes one JSONL transcript file per session under
 * ~/.claude/projects/<cwd-with-slashes-as-dashes>/<session-id>.jsonl.
 * Each assistant message line carries message.usage with the same shape
 * the Anthropic Messages API returns.
 */
function claudeProjectsDir(): string {
  // Overridable for tests; real usage always reads the user's actual Claude Code data dir.
  return process.env["TOKENTRAIL_CLAUDE_PROJECTS_DIR"] ?? join(homedir(), ".claude", "projects");
}

interface ClaudeUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface ClaudeAssistantLine {
  type: string;
  cwd?: string;
  message?: {
    id?: string;
    usage?: ClaudeUsage;
  };
}

async function listSessionFiles(): Promise<string[]> {
  const root = claudeProjectsDir();
  let projectDirs: string[];
  try {
    projectDirs = await readdir(root);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const files: string[] = [];
  for (const dir of projectDirs) {
    const dirPath = join(root, dir);
    let entries: string[];
    try {
      const st = await stat(dirPath);
      if (!st.isDirectory()) continue;
      entries = await readdir(dirPath);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.endsWith(".jsonl")) {
        files.push(join(dirPath, entry));
      }
    }
  }
  return files;
}

async function collectFromFile(
  filePath: string,
  repoPath: string,
  seenMessageIds: Set<string>,
): Promise<TokenCounts> {
  let total = emptyTokenCounts();
  const rl = createInterface({
    input: createReadStream(filePath, "utf8"),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    let obj: ClaudeAssistantLine;
    try {
      obj = JSON.parse(line);
    } catch {
      continue; // tolerate partially-written or corrupt lines
    }
    if (obj.type !== "assistant") continue;
    if (!obj.cwd || resolve(obj.cwd) !== repoPath) continue;

    const usage = obj.message?.usage;
    if (!usage) continue;

    const messageId = obj.message?.id;
    if (messageId) {
      if (seenMessageIds.has(messageId)) continue;
      seenMessageIds.add(messageId);
    }

    total = addTokenCounts(total, {
      input: usage.input_tokens ?? 0,
      output: usage.output_tokens ?? 0,
      cacheRead: usage.cache_read_input_tokens ?? 0,
      cacheCreation: usage.cache_creation_input_tokens ?? 0,
    });
  }

  return total;
}

export const claudeCodeAdapter: LogAdapter = {
  id: "claude-code",
  displayName: "Claude Code",

  async isAvailable(): Promise<boolean> {
    const files = await listSessionFiles();
    return files.length > 0;
  },

  async collect(repoPath: string): Promise<TokenCounts> {
    const absoluteRepoPath = resolve(repoPath);
    const files = await listSessionFiles();
    const seenMessageIds = new Set<string>();

    let total = emptyTokenCounts();
    for (const file of files) {
      const fileTotal = await collectFromFile(file, absoluteRepoPath, seenMessageIds);
      total = addTokenCounts(total, fileTotal);
    }
    return total;
  },
};
