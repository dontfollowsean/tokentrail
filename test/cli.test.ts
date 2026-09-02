import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const cliPath = join(process.cwd(), "src", "cli.ts");
const tsxBin = join(process.cwd(), "node_modules", ".bin", "tsx");

function runCli(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(tsxBin, [cliPath, ...args], { cwd });
}

describe("cli --repo/--storage default resolution", () => {
  let root: string;
  let repoDir: string;
  let elsewhereDir: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "tokentrail-cli-"));
    repoDir = join(root, "repo");
    elsewhereDir = join(root, "elsewhere");
    await mkdir(repoDir, { recursive: true });
    await mkdir(elsewhereDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("add (run from a different cwd) and show (run from the repo) agree on the same default storage file via --repo", async () => {
    // Simulates a CI script that calls `add` from an unrelated cwd, passing only --repo.
    await runCli(["add", "--agent", "codex", "--tokens", "1234", "--repo", repoDir, "--quiet"], elsewhereDir);

    // A later `show --repo <repoDir>` run from the repo itself (no --storage) must see it.
    const { stdout } = await runCli(["show", "--repo", repoDir, "--json"], repoDir);
    const store = JSON.parse(stdout);
    expect(store.agents["codex"]?.total).toBe(1234);

    // And the file must have landed inside the repo, not in the unrelated cwd it was invoked from.
    const persisted = JSON.parse(await readFile(join(repoDir, ".token-usage.json"), "utf8"));
    expect(persisted.agents["codex"]?.total).toBe(1234);
    await expect(readFile(join(elsewhereDir, ".token-usage.json"), "utf8")).rejects.toThrow(/ENOENT/);
  });

  it("badge (run from a different cwd) picks up usage written via --repo-scoped add", async () => {
    await runCli(["add", "--agent", "cursor", "--tokens", "500", "--repo", repoDir, "--quiet"], elsewhereDir);

    const outPath = join(elsewhereDir, "badge.svg");
    await runCli(["badge", "--repo", repoDir, "--out", outPath, "--quiet"], elsewhereDir);

    const svg = await readFile(outPath, "utf8");
    expect(svg).toContain("cursor");
    expect(svg).toContain("500");
  });
}, 30000);
