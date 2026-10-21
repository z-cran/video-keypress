import Button, { type ButtonProps } from "@mui/material/Button";
import type { ReactNode } from "react";

interface VideoFileButtonProps extends Omit<ButtonProps, "onChange"> {
  onFiles: (files: File[]) => void;
  accept?: string;
  children: ReactNode;
}

/** A button that opens the file picker. The input is inside the label. */
export default function VideoFileButton({
  onFiles,
  accept = "video/*",
  children,
  ...props
}: VideoFileButtonProps) {
  return (
    <Button component="label" nativeButton={false} {...props}>
      {children}
      <input
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          // Reset so picking the same file again still fires onChange.
          e.currentTarget.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
    </Button>
  );
}
