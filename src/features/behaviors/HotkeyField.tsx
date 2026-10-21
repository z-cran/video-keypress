import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import { useState } from "react";
import { hotkeyLabel, type Hotkey } from "./hotkeys.ts";

interface HotkeyFieldProps {
  value: Hotkey | null;
  onChange: (hotkey: Hotkey | null) => void;
  /** Why a key cannot be used here, or null. */
  problemFor: (code: string) => string | null;
  behaviorName: string;
}

const MODIFIER_CODES = new Set([
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  "CapsLock"
]);

/** Click, then press the key to bind. Escape cancels, Backspace clears. */
export default function HotkeyField({
  value,
  onChange,
  problemFor,
  behaviorName
}: HotkeyFieldProps) {
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = behaviorName || "this behavior";

  return (
    <Box sx={{ minWidth: 128 }}>
      <Stack direction="row" sx={{ alignItems: "center" }}>
        <Button
          variant={capturing ? "contained" : "outlined"}
          size="small"
          aria-label={`Hotkey for ${name}: ${capturing ? "press a key" : (value?.label ?? "none")}`}
          onClick={() => {
            setCapturing(true);
            setError(null);
          }}
          onBlur={() => setCapturing(false)}
          onKeyDown={(e) => {
            if (!capturing || e.key === "Tab") return;
            // Keep Escape from closing the dialog and Space from clicking.
            e.preventDefault();
            e.stopPropagation();
            if (MODIFIER_CODES.has(e.code)) return;
            if (e.key === "Escape") {
              setCapturing(false);
              return;
            }
            if (e.key === "Backspace" || e.key === "Delete") {
              onChange(null);
              setCapturing(false);
              return;
            }
            if (e.ctrlKey || e.metaKey || e.altKey) {
              setError("Use a single key, without Ctrl, Alt or Cmd.");
              return;
            }
            const problem = problemFor(e.code);
            if (problem) {
              setError(problem);
              return;
            }
            onChange({ code: e.code, label: hotkeyLabel(e.code, e.key) });
            setError(null);
            setCapturing(false);
          }}
          onKeyUp={(e) => {
            if (capturing) e.preventDefault();
          }}
          sx={{ minWidth: 96, fontWeight: 700 }}
        >
          {capturing ? "Press a key" : (value?.label ?? "No key")}
        </Button>
        {value && !capturing && (
          <IconButton
            size="small"
            aria-label={`Remove hotkey for ${name}`}
            onClick={() => onChange(null)}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
      {error && (
        <FormHelperText error role="alert" sx={{ maxWidth: 240 }}>
          {error}
        </FormHelperText>
      )}
    </Box>
  );
}
