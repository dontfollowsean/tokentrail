import type { UsageStore } from "./types.js";

/** Renders large token counts the way GitHub-style badges do: 12345 -> 12.3k, 4200000 -> 4.2M. */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = (n / 1000).toFixed(n < 10_000 ? 1 : 0);
    if (Number(k) < 1000) return `${k}k`;
  }
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)}M`;
}

const FONT_FAMILY =
  "Verdana,Geneva,DejaVu Sans,sans-serif";
const CHAR_WIDTH = 6.2; // approximate advance width at 11px Verdana, used for layout math only
const PADDING = 10;
const LABEL_HEIGHT = 20;

function textWidth(text: string): number {
  return Math.round(text.length * CHAR_WIDTH) + PADDING * 2;
}

interface Segment {
  label: string;
  value: string;
  color: string;
}

const AGENT_COLORS: Record<string, string> = {
  "claude-code": "#d97757",
};
const DEFAULT_COLOR = "#555555";

function colorForAgent(id: string): string {
  return AGENT_COLORS[id] ?? DEFAULT_COLOR;
}

/**
 * Builds a self-contained SVG badge (no external calls, no shields.io) showing
 * cumulative token counts per agent, e.g. "tokentrail | claude-code 128.4k".
 */
export function renderBadgeSvg(store: UsageStore): string {
  const agentIds = Object.keys(store.agents).sort();

  const segments: Segment[] = [
    { label: "", value: "tokentrail", color: "#2b2b2b" },
    ...(agentIds.length === 0
      ? [{ label: "", value: "no data", color: DEFAULT_COLOR }]
      : agentIds.map((id) => ({
          label: id,
          value: formatCount(store.agents[id]!.total),
          color: colorForAgent(id),
        }))),
  ];

  const widths = segments.map((s) => textWidth(s.label ? `${s.label} ${s.value}` : s.value));
  const totalWidth = widths.reduce((a, b) => a + b, 0);

  let x = 0;
  const rects: string[] = [];
  const texts: string[] = [];

  segments.forEach((seg, i) => {
    const w = widths[i]!;
    rects.push(`<rect x="${x}" y="0" width="${w}" height="${LABEL_HEIGHT}" fill="${seg.color}"/>`);
    const label = seg.label ? `${seg.label} ${seg.value}` : seg.value;
    const textX = x + w / 2;
    texts.push(
      `<text x="${textX}" y="14" font-family="${FONT_FAMILY}" font-size="11" fill="#ffffff" text-anchor="middle">${escapeXml(
        label,
      )}</text>`,
    );
    x += w;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${LABEL_HEIGHT}" role="img" aria-label="${escapeXml(
    ariaLabel(store),
  )}">
  <title>${escapeXml(ariaLabel(store))}</title>
  <g shape-rendering="crispEdges">
    ${rects.join("\n    ")}
  </g>
  <g>
    ${texts.join("\n    ")}
  </g>
</svg>
`;
}

function ariaLabel(store: UsageStore): string {
  const agentIds = Object.keys(store.agents).sort();
  if (agentIds.length === 0) return "tokentrail: no data";
  return `tokentrail: ${agentIds
    .map((id) => `${id} ${formatCount(store.agents[id]!.total)} tokens`)
    .join(", ")}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
