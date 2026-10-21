import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import { useState } from "react";
import ControlButton from "../../components/ControlButton.tsx";
import { formatRate, MAX_RATE, MIN_RATE, RATES } from "./playback.ts";
import { usePlayerStore } from "./playerStore.ts";

export default function SpeedControl() {
  const rate = usePlayerStore((s) => s.rate);
  const setRate = usePlayerStore((s) => s.setRate);
  const stepRate = usePlayerStore((s) => s.stepRate);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <Stack direction="row" sx={{ alignItems: "center" }}>
      <ControlButton
        label="Slower"
        shortcut="Shift + ,"
        size="small"
        disabled={rate <= MIN_RATE}
        onClick={() => stepRate(-1)}
      >
        <RemoveIcon fontSize="small" />
      </ControlButton>
      <Tooltip title="Playback speed" describeChild>
        <Button
          size="small"
          aria-haspopup="menu"
          aria-label={`Playback speed ${formatRate(rate)}`}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{
            minWidth: 56,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 700
          }}
        >
          {formatRate(rate)}
        </Button>
      </Tooltip>
      <ControlButton
        label="Faster"
        shortcut="Shift + ."
        size="small"
        disabled={rate >= MAX_RATE}
        onClick={() => stepRate(1)}
      >
        <AddIcon fontSize="small" />
      </ControlButton>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => setAnchor(null)}
      >
        {RATES.map((r) => (
          <MenuItem
            key={r}
            selected={r === rate}
            onClick={() => {
              setRate(r);
              setAnchor(null);
            }}
          >
            {formatRate(r)}
          </MenuItem>
        ))}
      </Menu>
    </Stack>
  );
}
