import CheckIcon from "@mui/icons-material/Check";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import { useState } from "react";
import { PALETTE } from "./behaviors.ts";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label: string;
}

const COLOR_NAMES: Record<string, string> = {
  "#0072B2": "Blue",
  "#E69F00": "Orange",
  "#009E73": "Green",
  "#CC79A7": "Pink",
  "#D55E00": "Red orange",
  "#56B4E9": "Sky blue",
  "#F0E442": "Yellow",
  "#999999": "Gray"
};

function Swatch({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        bgcolor: color,
        border: 2,
        borderColor: "background.paper",
        boxShadow: (t) => `0 0 0 1px ${t.palette.divider}`
      }}
    />
  );
}

export default function ColorPicker({
  color,
  onChange,
  label
}: ColorPickerProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <IconButton
        aria-label={label}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <Swatch color={color} />
      </IconButton>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{
          // A dialog role keeps the global player keys out of the picker.
          paper: { role: "dialog", "aria-label": label, sx: { p: 1 } }
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0.5
          }}
        >
          {PALETTE.map((c) => (
            <IconButton
              key={c}
              aria-label={COLOR_NAMES[c] ?? c}
              aria-pressed={c.toUpperCase() === color.toUpperCase()}
              onClick={() => {
                onChange(c);
                setAnchor(null);
              }}
              sx={{ position: "relative" }}
            >
              <Swatch color={c} size={26} />
              {c.toUpperCase() === color.toUpperCase() && (
                <CheckIcon
                  fontSize="small"
                  sx={{
                    position: "absolute",
                    color: "common.white",
                    mixBlendMode: "difference"
                  }}
                />
              )}
            </IconButton>
          ))}
        </Box>
      </Popover>
    </>
  );
}
