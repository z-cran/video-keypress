import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent
} from "react";
import ControlButton from "../../components/ControlButton.tsx";
import { formatClock, formatDuration } from "../../lib/time.ts";
import { useBehaviorsStore } from "../behaviors/behaviorsStore.ts";
import { usePlayerStore } from "../player/playerStore.ts";
import type { Episode } from "../recording/recorder.ts";
import { useSessionStore } from "../recording/sessionStore.ts";
import {
  AXIS_HEIGHT,
  chartHeight,
  hitTest,
  LANE_HEIGHT,
  laneAt,
  laneTop,
  layoutBars,
  makeScale,
  MIN_BAR_PX,
  niceTicks,
  timelineSpan,
  timeToX,
  xToTime,
  ZOOMS,
  type Bar,
  type Scale
} from "./timelineScale.ts";

const LABEL_WIDTH = 132;
const LABEL_WIDTH_XS = 92;
const NO_EPISODES: Episode[] = [];

interface Drag {
  pointerId: number;
  startX: number;
  bar: Bar | null;
  scrubbing: boolean;
}

/** Episodes still being recorded; re-renders with the video clock. */
function ActiveBars({
  scale,
  laneOf,
  colorOf
}: {
  scale: Scale;
  laneOf: ReadonlyMap<string, number>;
  colorOf: ReadonlyMap<string, string>;
}) {
  const active = useSessionStore((s) => s.active);
  const now = usePlayerStore((s) => s.currentTime);
  return (
    <g>
      {Object.values(active).map((a) => {
        const lane = laneOf.get(a.behaviorId);
        if (lane === undefined) return null;
        const from = Math.min(a.start, now);
        const width = Math.max(
          MIN_BAR_PX,
          Math.abs(now - a.start) * scale.pxPerSec
        );
        const color = colorOf.get(a.behaviorId) ?? "#999999";
        return (
          <rect
            key={a.behaviorId}
            data-testid="active-bar"
            x={timeToX(scale, from)}
            y={laneTop(lane) + 3}
            width={width}
            height={LANE_HEIGHT - 6}
            rx={3}
            style={{
              fill: color,
              fillOpacity: 0.45,
              stroke: color,
              strokeWidth: 2,
              strokeDasharray: "4 2"
            }}
          />
        );
      })}
    </g>
  );
}

export default function Timeline() {
  const theme = useTheme();
  const behaviors = useBehaviorsStore((s) => s.behaviors);
  const episodes = useSessionStore((s) => s.session?.episodes ?? NO_EPISODES);
  const sessionDuration = useSessionStore(
    (s) => s.session?.video.duration ?? Number.NaN
  );
  const selectedId = useSessionStore((s) => s.selectedId);
  const playerDuration = usePlayerStore((s) => s.duration);
  const canSeek = usePlayerStore((s) => s.ready);
  const [width, setWidth] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<SVGLineElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const centerOnRef = useRef<number | null>(null);

  const duration = Number.isFinite(sessionDuration)
    ? sessionDuration
    : playerDuration;
  const span = timelineSpan(duration, episodes, 0);
  const scale = useMemo(
    () => makeScale(span, width, ZOOMS[zoomIndex]!),
    [span, width, zoomIndex]
  );
  const laneOf = useMemo(
    () => new Map(behaviors.map((b, i) => [b.id, i])),
    [behaviors]
  );
  const colorOf = useMemo(
    () => new Map(behaviors.map((b) => [b.id, b.color])),
    [behaviors]
  );
  const bars = useMemo(
    () => layoutBars(episodes, laneOf, scale),
    [episodes, laneOf, scale]
  );
  const ticks = useMemo(() => niceTicks(scale), [scale]);
  const height = chartHeight(behaviors.length);
  const selected = episodes.find((e) => e.id === selectedId) ?? null;
  const selectedBehavior = behaviors.find((b) => b.id === selected?.behaviorId);

  // Measure the scrolling area; the SVG is drawn only once it has a width.
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry?.contentRect.width ?? 0);
      setWidth((prev) => (prev === next ? prev : next));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // Move the playhead every frame without re-rendering the bars, and keep
  // it in view while the video plays.
  useEffect(() => {
    let frame = 0;
    let lastX = Number.NaN;
    const loop = () => {
      const player = usePlayerStore.getState();
      const x = timeToX(scale, player.el?.currentTime ?? 0);
      if (x !== lastX) {
        playheadRef.current?.setAttribute("transform", `translate(${x} 0)`);
        lastX = x;
        const box = scrollRef.current;
        if (
          box &&
          !player.paused &&
          (x < box.scrollLeft || x > box.scrollLeft + box.clientWidth - 24)
        ) {
          box.scrollLeft = Math.max(0, x - box.clientWidth * 0.1);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [scale]);

  // After a zoom, keep the playhead where the eye was.
  useLayoutEffect(() => {
    const box = scrollRef.current;
    const t = centerOnRef.current;
    if (!box || t === null) return;
    centerOnRef.current = null;
    box.scrollLeft = Math.max(0, timeToX(scale, t) - box.clientWidth / 2);
  }, [scale]);

  const zoomTo = (index: number) => {
    centerOnRef.current = usePlayerStore.getState().getTime() || 0;
    setZoomIndex(Math.max(0, Math.min(ZOOMS.length - 1, index)));
  };

  const pointFrom = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const { seek } = usePlayerStore.getState();
  const { select, deleteEpisode } = useSessionStore.getState();

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const { x, y } = pointFrom(e);
    const bar = hitTest(bars, x, laneAt(y, behaviors.length), 6, selectedId);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: x,
      bar,
      scrubbing: bar === null
    };
    if (!bar) {
      select(null);
      seek(xToTime(scale, x));
    }
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const { x } = pointFrom(e);
    if (!drag.scrubbing && Math.abs(x - drag.startX) > 3) drag.scrubbing = true;
    if (drag.scrubbing) seek(xToTime(scale, x));
  };

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (drag.bar && !drag.scrubbing) {
      select(drag.bar.episode.id);
      seek(drag.bar.episode.start);
    }
  };

  const ordered = selectedId
    ? [
        ...bars.filter((b) => b.episode.id !== selectedId),
        ...bars.filter((b) => b.episode.id === selectedId)
      ]
    : bars;
  const tickDecimals = ticks.length > 1 && ticks[1]! < 1 ? 1 : 0;
  const vars = theme.vars ?? theme;

  return (
    <Paper component="section" aria-labelledby="timeline-title" sx={{ p: 2 }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", mb: 1, gap: 1, flexWrap: "wrap" }}
      >
        <Typography
          id="timeline-title"
          variant="subtitle1"
          component="h2"
          sx={{ fontWeight: 700 }}
        >
          Timeline
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flex: 1, display: { xs: "none", sm: "block" } }}
        >
          Click to jump to a moment. Click an episode to select it.
        </Typography>
        <Box sx={{ flex: 1, display: { xs: "block", sm: "none" } }} />
        <ControlButton
          label="Zoom out"
          size="small"
          disabled={zoomIndex === 0}
          onClick={() => zoomTo(zoomIndex - 1)}
        >
          <ZoomOutIcon fontSize="small" />
        </ControlButton>
        <Typography
          variant="caption"
          sx={{ minWidth: 32, textAlign: "center" }}
        >
          {ZOOMS[zoomIndex]}x
        </Typography>
        <ControlButton
          label="Zoom in"
          size="small"
          disabled={zoomIndex === ZOOMS.length - 1}
          onClick={() => zoomTo(zoomIndex + 1)}
        >
          <ZoomInIcon fontSize="small" />
        </ControlButton>
        <ControlButton
          label="Fit to width"
          size="small"
          disabled={zoomIndex === 0}
          onClick={() => zoomTo(0)}
        >
          <FitScreenIcon fontSize="small" />
        </ControlButton>
      </Stack>

      <Box sx={{ display: "flex" }}>
        <Box
          sx={{
            position: "relative",
            width: { xs: LABEL_WIDTH_XS, sm: LABEL_WIDTH },
            flexShrink: 0,
            height
          }}
          aria-hidden
        >
          {behaviors.map((b, i) => (
            <Box
              key={b.id}
              sx={{
                position: "absolute",
                top: laneTop(i),
                height: LANE_HEIGHT,
                left: 0,
                right: 8,
                display: "flex",
                alignItems: "center",
                gap: 1
              }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: b.color,
                  flexShrink: 0
                }}
              />
              <Typography variant="body2" noWrap title={b.name}>
                {b.name}
              </Typography>
            </Box>
          ))}
        </Box>
        <Box
          ref={scrollRef}
          sx={{ flex: 1, minWidth: 0, overflowX: "auto", overflowY: "hidden" }}
        >
          {width > 0 && (
            <svg
              width={scale.width}
              height={height}
              role="img"
              aria-label={`Timeline with ${episodes.length} ${episodes.length === 1 ? "episode" : "episodes"}`}
              data-testid="timeline-svg"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => (dragRef.current = null)}
              style={{
                display: "block",
                cursor: canSeek ? "pointer" : "default",
                touchAction: "pan-x"
              }}
            >
              {behaviors.map((b, i) => (
                <rect
                  key={b.id}
                  x={0}
                  y={laneTop(i)}
                  width={scale.width}
                  height={LANE_HEIGHT}
                  style={{
                    fill:
                      i % 2 === 0 ? vars.palette.action.hover : "transparent"
                  }}
                />
              ))}
              {ticks.map((t, i) => {
                const x = timeToX(scale, t);
                const anchor =
                  i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle";
                return (
                  <g key={t}>
                    <line
                      x1={x}
                      x2={x}
                      y1={AXIS_HEIGHT - 4}
                      y2={height}
                      style={{ stroke: vars.palette.divider }}
                    />
                    <text
                      x={x}
                      y={14}
                      textAnchor={anchor}
                      style={{
                        fill: vars.palette.text.secondary,
                        fontSize: 11
                      }}
                    >
                      {formatClock(t, tickDecimals)}
                    </text>
                  </g>
                );
              })}
              <g>
                {ordered.map((bar) => {
                  const isSelected = bar.episode.id === selectedId;
                  return (
                    <rect
                      key={bar.episode.id}
                      data-testid="episode-bar"
                      data-episode-id={bar.episode.id}
                      x={bar.x}
                      y={laneTop(bar.lane) + 3}
                      width={bar.width}
                      height={LANE_HEIGHT - 6}
                      rx={3}
                      style={{
                        fill: colorOf.get(bar.episode.behaviorId),
                        fillOpacity: 0.85,
                        stroke: isSelected ? vars.palette.text.primary : "none",
                        strokeWidth: 2
                      }}
                    />
                  );
                })}
              </g>
              <ActiveBars scale={scale} laneOf={laneOf} colorOf={colorOf} />
              <line
                ref={playheadRef}
                x1={0}
                x2={0}
                y1={0}
                y2={height}
                style={{
                  stroke: vars.palette.secondary.main,
                  strokeWidth: 2,
                  pointerEvents: "none"
                }}
              />
            </svg>
          )}
        </Box>
      </Box>

      {selected && (
        <Stack
          direction="row"
          aria-live="polite"
          sx={{ mt: 1.5, alignItems: "center", gap: 1, flexWrap: "wrap" }}
        >
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: selectedBehavior?.color
            }}
          />
          <Typography
            variant="body2"
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            <strong>{selectedBehavior?.name}</strong> ·{" "}
            {formatClock(selected.start)} to {formatClock(selected.end)} ·{" "}
            {formatDuration(selected.end - selected.start)}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            disabled={!canSeek}
            onClick={() => seek(selected.start)}
          >
            Go to start
          </Button>
          <Button
            size="small"
            color="error"
            startIcon={<DeleteOutlinedIcon />}
            onClick={() => deleteEpisode(selected.id)}
          >
            Delete episode
          </Button>
        </Stack>
      )}
    </Paper>
  );
}
