import { describe, expect, it } from "vitest";
import { formatCount, renderBadgeSvg } from "../src/badge.js";
import { emptyUsageStore } from "../src/types.js";

describe("formatCount", () => {
  it("leaves small numbers as-is", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
  });

  it("formats thousands with one decimal below 10k", () => {
    expect(formatCount(1234)).toBe("1.2k");
    expect(formatCount(9999)).toBe("10.0k");
  });

  it("formats thousands without decimals above 10k", () => {
    expect(formatCount(12345)).toBe("12k");
  });

  it("formats millions", () => {
    expect(formatCount(4200000)).toBe("4.2M");
  });

  it("bumps to the next unit when rounding hits the boundary", () => {
    expect(formatCount(999500)).toBe("1.0M");
    expect(formatCount(999999)).toBe("1.0M");
    expect(formatCount(999499)).toBe("999k");
  });
});

describe("renderBadgeSvg", () => {
  it("renders a placeholder badge when there is no data", () => {
    const svg = renderBadgeSvg(emptyUsageStore());
    expect(svg).toContain("<svg");
    expect(svg).toContain("no data");
  });

  it("renders one segment per agent with its formatted total", () => {
    const store = emptyUsageStore();
    store.agents["claude-code"] = {
      parsed: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
      manual: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
      total: 128400,
      costUsd: null,
      lastUpdated: new Date().toISOString(),
    };
    const svg = renderBadgeSvg(store);
    expect(svg).toContain("claude-code 128k");
    expect(svg).not.toContain("no data");
  });

  it("escapes agent ids that could break the XML", () => {
    const store = emptyUsageStore();
    store.agents["<script>"] = {
      parsed: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
      manual: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
      total: 1,
      costUsd: null,
      lastUpdated: new Date().toISOString(),
    };
    const svg = renderBadgeSvg(store);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });
});
