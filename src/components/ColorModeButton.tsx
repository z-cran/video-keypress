import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { useColorScheme } from "@mui/material/styles";
import ControlButton from "./ControlButton.tsx";

const NEXT = { system: "light", light: "dark", dark: "system" } as const;
const LABEL = {
  system: "Theme: match the system",
  light: "Theme: light",
  dark: "Theme: dark"
} as const;

/** Cycles system, light and dark. MUI remembers the choice in localStorage. */
export default function ColorModeButton() {
  const { mode, setMode } = useColorScheme();
  const current = mode ?? "system";
  return (
    <ControlButton
      label={LABEL[current]}
      size="small"
      onClick={() => setMode(NEXT[current])}
    >
      {current === "light" ? (
        <LightModeIcon fontSize="small" />
      ) : current === "dark" ? (
        <DarkModeIcon fontSize="small" />
      ) : (
        <BrightnessAutoIcon fontSize="small" />
      )}
    </ControlButton>
  );
}
