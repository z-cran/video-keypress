import IconButton, { type IconButtonProps } from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import type { ReactNode } from "react";

interface ControlButtonProps extends Omit<IconButtonProps, "aria-label"> {
  /** Accessible name, e.g. "Play". */
  label: string;
  /** Shortcut shown in the tooltip, e.g. "Space". */
  shortcut?: string;
  children: ReactNode;
}

/** Icon button with a tooltip that names the action and its shortcut. */
export default function ControlButton({
  label,
  shortcut,
  children,
  ...props
}: ControlButtonProps) {
  return (
    <Tooltip title={shortcut ? `${label} (${shortcut})` : label}>
      {/* The span keeps the tooltip working while the button is disabled. */}
      <span>
        <IconButton aria-label={label} {...props}>
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}
