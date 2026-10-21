import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import { useEffect } from "react";
import AppFooter from "./components/AppFooter.tsx";
import AppHeader from "./components/AppHeader.tsx";
import Notices from "./components/Notices.tsx";
import PlayerControls from "./features/player/PlayerControls.tsx";
import VideoDropZone from "./features/player/VideoDropZone.tsx";
import VideoFileButton from "./features/player/VideoFileButton.tsx";
import VideoPlayer from "./features/player/VideoPlayer.tsx";
import { usePlayerStore } from "./features/player/playerStore.ts";
import { useGlobalKeys } from "./features/recording/useGlobalKeys.ts";
import { openVideo } from "./features/session/openVideo.ts";

/**
 * Without this, a file dropped outside the drop zone makes the browser
 * navigate to it and the session is gone.
 */
function useWindowFileDrop(onFiles: (files: File[]) => void) {
  useEffect(() => {
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) onFiles(files);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [onFiles]);
}

function Workspace() {
  const error = usePlayerStore((s) => s.error);

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 8 }}>
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <VideoFileButton onFiles={openVideo} color="inherit" size="small">
                Choose another
              </VideoFileButton>
            }
          >
            {error}
          </Alert>
        )}
        <VideoPlayer />
        <PlayerControls />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }} />
    </Grid>
  );
}

export default function App() {
  useGlobalKeys();
  useWindowFileDrop(openVideo);
  const hasVideo = usePlayerStore((s) => s.source !== null);

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />
      <Container component="main" maxWidth="xl" sx={{ flex: 1, py: 3 }}>
        {hasVideo ? <Workspace /> : <VideoDropZone onFiles={openVideo} />}
      </Container>
      <AppFooter />
      <Notices />
    </Box>
  );
}
