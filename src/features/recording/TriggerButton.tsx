import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { PointerEvent } from "react";
import { formatDuration } from "../../lib/time.ts";
import type { Behavior } from "../behaviors/behaviors.ts";
import { usePlayerStore } from "../player/playerStore.ts";
import type { ActiveEpisode } from "./recorder.ts";
import { useSessionStore } from "./sessionStore.ts";
import { liveElapsed, type BehaviorTally } from "./tally.ts";

interface TriggerButtonProps {
  behavior: Behavior;
  tally: BehaviorTally | undefined;
  active: ActiveEpisode | undefined;
  disabled: boolean;
}

/** Re-renders on its own as the video plays, so idle buttons stay still. */
function LiveElapsed({ start }: { start: number }) {
  const now = usePlayerStore((s) => s.currentTime);
  return <>{formatDuration(liveElapsed(start, now))}</>;
}

export default function TriggerButton({
  behavior,
  tally,
  active,
  disabled
}: TriggerButtonProps) {
  const isHold = behavior.mode === "hold";
  const recording = active !== undefined;

  const holder = (e: PointerEvent) => `pointer:${e.pointerId}` as const;
  const endPointer = (e: PointerEvent) => {
    if (isHold) useSessionStore.getState().release(behavior.id, holder(e));
  };

  return (
    <ButtonBase
      disabled={disabled}
      aria-pressed={recording}
      aria-label={`${behavior.name}${behavior.hotkey ? `, key ${behavior.hotkey.label}` : ""}, ${isHold ? "hold" : "toggle"}`}
      onPointerDown={(e) => {
        if (!isHold || e.button !== 0) return;
        // Capture so moving off the button while holding still ends it here.
        e.currentTarget.setPointerCapture(e.pointerId);
        useSessionStore.getState().press(behavior, holder(e));
      }}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onLostPointerCapture={endPointer}
      onClick={() => {
        if (!isHold) useSessionStore.getState().press(behavior, "pointer:0");
      }}
      onContextMenu={(e) => e.preventDefault()}
      sx={(theme) => ({
        display: "block",
        width: "100%",
        textAlign: "left",
        p: 1.5,
        borderRadius: 2,
        border: 2,
        borderColor: recording ? behavior.color : "divider",
        bgcolor: recording ? alpha(behavior.color, 0.18) : "background.paper",
        touchAction: "none",
        userSelect: "none",
        transition: "background-color 80ms, border-color 80ms",
        "&:hover": { bgcolor: alpha(behavior.color, recording ? 0.24 : 0.08) },
        "&.Mui-focusVisible": {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 2
        },
        "&.Mui-disabled": { opacity: 0.5 }
      })}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            bgcolor: behavior.color,
            flexShrink: 0
          }}
        />
        <Typography
          variant="subtitle2"
          noWrap
          sx={{ flex: 1, fontWeight: 700 }}
        >
          {behavior.name}
        </Typography>
        <Typography
          component="span"
          variant="caption"
          sx={{
            px: 0.75,
            borderRadius: 1,
            border: 1,
            borderColor: "divider",
            fontWeight: 700,
            fontFamily: "monospace",
            visibility: behavior.hotkey ? "visible" : "hidden"
          }}
        >
          {behavior.hotkey?.label ?? "-"}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 0.75 }}>
        <Typography
          data-testid="trigger-count"
          sx={{
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {tally?.count ?? 0}
        </Typography>
        <Typography
          data-testid="trigger-total"
          variant="body2"
          color="text.secondary"
          sx={{ fontVariantNumeric: "tabular-nums" }}
        >
          {formatDuration(tally?.total ?? 0)}
        </Typography>
      </Box>
      <Typography
        variant="caption"
        color={recording ? "text.primary" : "text.secondary"}
        sx={{ display: "block", mt: 0.5, fontVariantNumeric: "tabular-nums" }}
      >
        {recording ? (
          <>
            Recording <LiveElapsed start={active.start} />
          </>
        ) : isHold ? (
          "Hold to record"
        ) : (
          "Press to start"
        )}
      </Typography>
    </ButtonBase>
  );
}
