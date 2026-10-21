import VideoFileOutlinedIcon from "@mui/icons-material/VideoFileOutlined";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState, type ReactNode } from "react";
import VideoFileButton from "./VideoFileButton.tsx";

interface VideoDropZoneProps {
  onFiles: (files: File[]) => void;
  /** Extra actions under the main button, e.g. opening saved scores. */
  children?: ReactNode;
}

export default function VideoDropZone({
  onFiles,
  children
}: VideoDropZoneProps) {
  const [over, setOver] = useState(false);

  return (
    <Paper
      onDragEnter={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        // The window-level drop handler would open the same files again.
        e.stopPropagation();
        setOver(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
      sx={{
        borderStyle: "dashed",
        borderWidth: 2,
        borderColor: over ? "primary.main" : "divider",
        bgcolor: over ? "action.hover" : "background.paper",
        transition: "background-color 120ms, border-color 120ms",
        px: 3,
        py: { xs: 6, md: 10 }
      }}
    >
      <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
        <VideoFileOutlinedIcon sx={{ fontSize: 64, color: "primary.main" }} />
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
          Drop a video here
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 520 }}>
          MP4 and WebM play in every browser. The video stays on this computer;
          nothing is uploaded.
        </Typography>
        <VideoFileButton variant="contained" size="large" onFiles={onFiles}>
          Choose a video
        </VideoFileButton>
        {children}
      </Stack>
    </Paper>
  );
}
