import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Forward5Icon from "@mui/icons-material/Forward5";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Replay5Icon from "@mui/icons-material/Replay5";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import Box from "@mui/material/Box";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ControlButton from "../../components/ControlButton.tsx";
import { formatClock } from "../../lib/time.ts";
import { SEEK_STEP } from "./playback.ts";
import { usePlayerStore } from "./playerStore.ts";
import SpeedControl from "./SpeedControl.tsx";

export default function PlayerControls() {
  const ready = usePlayerStore((s) => s.ready);
  const paused = usePlayerStore((s) => s.paused);
  const duration = usePlayerStore((s) => s.duration);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const muted = usePlayerStore((s) => s.muted);
  const { toggle, seek, seekBy, stepFrame, setMuted } =
    usePlayerStore.getState();

  const knownDuration = Number.isFinite(duration) && duration > 0;
  const max = knownDuration ? duration : Math.max(currentTime, 1);

  return (
    <Stack spacing={0.5} sx={{ mt: 1 }}>
      <Slider
        aria-label="Seek"
        size="small"
        min={0}
        max={max}
        step={0.001}
        value={Math.min(currentTime, max)}
        disabled={!ready}
        onChange={(_, value) => seek(value)}
        valueLabelDisplay="auto"
        valueLabelFormat={(v) => formatClock(v, 2)}
        sx={{ mx: 1, width: "auto" }}
      />
      <Stack
        direction="row"
        sx={{ alignItems: "center", flexWrap: "wrap", columnGap: 0.5 }}
      >
        <ControlButton
          label={paused ? "Play" : "Pause"}
          shortcut="Space"
          disabled={!ready}
          onClick={toggle}
          color="primary"
        >
          {paused ? <PlayArrowIcon /> : <PauseIcon />}
        </ControlButton>
        <ControlButton
          label={`Back ${SEEK_STEP} seconds`}
          shortcut="Left arrow"
          disabled={!ready}
          onClick={() => seekBy(-SEEK_STEP)}
        >
          <Replay5Icon />
        </ControlButton>
        <ControlButton
          label="Previous frame"
          shortcut=","
          disabled={!ready}
          onClick={() => stepFrame(-1)}
        >
          <ChevronLeftIcon />
        </ControlButton>
        <ControlButton
          label="Next frame"
          shortcut="."
          disabled={!ready}
          onClick={() => stepFrame(1)}
        >
          <ChevronRightIcon />
        </ControlButton>
        <ControlButton
          label={`Forward ${SEEK_STEP} seconds`}
          shortcut="Right arrow"
          disabled={!ready}
          onClick={() => seekBy(SEEK_STEP)}
        >
          <Forward5Icon />
        </ControlButton>
        <Typography
          variant="body2"
          sx={{
            fontVariantNumeric: "tabular-nums",
            px: 1,
            whiteSpace: "nowrap"
          }}
        >
          {formatClock(currentTime, 2)} / {formatClock(duration, 2)}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <SpeedControl />
        <ControlButton
          label={muted ? "Unmute" : "Mute"}
          onClick={() => setMuted(!muted)}
        >
          {muted ? <VolumeOffIcon /> : <VolumeUpIcon />}
        </ControlButton>
      </Stack>
    </Stack>
  );
}
