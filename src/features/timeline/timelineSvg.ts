import { formatClock } from "../../lib/time.ts";
import type { Behavior } from "../behaviors/behaviors.ts";
import type { Session } from "../session/session.ts";
import {
  AXIS_HEIGHT,
  chartHeight,
  LANE_HEIGHT,
  laneTop,
  layoutBars,
  makeScale,
  niceTicks,
  timelineSpan,
  timeToX
} from "./timelineScale.ts";

const LABEL_WIDTH = 160;
const MAX_LABEL_CHARS = 22;

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function truncate(text: string): string {
  return text.length > MAX_LABEL_CHARS
    ? `${text.slice(0, MAX_LABEL_CHARS - 1)}…`
    : text;
}

/**
 * A standalone SVG of the timeline, built from data rather than copied from
 * the screen, with fixed light colors so it prints and imports anywhere.
 */
export function buildTimelineSvg(
  session: Session,
  behaviors: readonly Behavior[],
  chartWidth = 1200
): string {
  const used = new Set(session.episodes.map((e) => e.behaviorId));
  const lanes = [
    ...behaviors,
    ...session.behaviors.filter(
      (b) => used.has(b.id) && !behaviors.some((l) => l.id === b.id)
    )
  ];
  const laneOf = new Map(lanes.map((b, i) => [b.id, i]));
  const scale = makeScale(
    timelineSpan(session.video.duration, session.episodes, 0),
    chartWidth,
    1
  );
  const bars = layoutBars(session.episodes, laneOf, scale);
  const ticks = niceTicks(scale);
  const decimals = ticks.length > 1 && ticks[1]! < 1 ? 1 : 0;
  const width = LABEL_WIDTH + scale.width + 16;
  const height = chartHeight(lanes.length) + 8;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Roboto, Helvetica, Arial, sans-serif" font-size="12">`,
    `<title>${escapeXml(`Timeline of ${session.video.fileName || "scores"}`)}</title>`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`
  ];
  lanes.forEach((b, i) => {
    const y = laneTop(i);
    if (i % 2 === 0) {
      parts.push(
        `<rect x="${LABEL_WIDTH}" y="${y}" width="${scale.width}" height="${LANE_HEIGHT}" fill="#f3f5f6"/>`
      );
    }
    parts.push(
      `<circle cx="10" cy="${y + LANE_HEIGHT / 2}" r="5" fill="${b.color}"/>`,
      `<text x="22" y="${y + LANE_HEIGHT / 2 + 4}" fill="#1f2a30">${escapeXml(truncate(b.name))}</text>`
    );
  });
  ticks.forEach((t, i) => {
    const x = LABEL_WIDTH + timeToX(scale, t);
    const anchor =
      i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle";
    parts.push(
      `<line x1="${x}" x2="${x}" y1="${AXIS_HEIGHT - 4}" y2="${height - 8}" stroke="#d5dadd"/>`,
      `<text x="${x}" y="14" text-anchor="${anchor}" fill="#5b6870" font-size="11">${formatClock(t, decimals)}</text>`
    );
  });
  for (const bar of bars) {
    const color = lanes[bar.lane]?.color ?? "#999999";
    parts.push(
      `<rect x="${LABEL_WIDTH + bar.x}" y="${laneTop(bar.lane) + 3}" width="${bar.width}" height="${LANE_HEIGHT - 6}" rx="3" fill="${color}" fill-opacity="0.85" shape-rendering="crispEdges"/>`
    );
  }
  parts.push("</svg>");
  return parts.join("\n");
}
