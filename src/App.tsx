import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import { useEffect } from "react";
import AppFooter from "./components/AppFooter.tsx";
import AppHeader from "./components/AppHeader.tsx";
import ConfirmDialog from "./components/ConfirmDialog.tsx";
import Notices from "./components/Notices.tsx";
import BehaviorSettingsDialog from "./features/behaviors/BehaviorSettingsDialog.tsx";
import { confirmBehaviorRemoval } from "./features/behaviors/confirmBehaviorRemoval.ts";
import { useSettingsDialog } from "./features/behaviors/settingsDialogStore.ts";
import PlayerControls from "./features/player/PlayerControls.tsx";
import { usePlayerStore } from "./features/player/playerStore.ts";
import VideoDropZone from "./features/player/VideoDropZone.tsx";
import VideoFileButton from "./features/player/VideoFileButton.tsx";
import VideoPlayer from "./features/player/VideoPlayer.tsx";
import { useSessionStore } from "./features/recording/sessionStore.ts";
import TallyTable from "./features/recording/TallyTable.tsx";
import TriggerPad from "./features/recording/TriggerPad.tsx";
import { useGlobalKeys } from "./features/recording/useGlobalKeys.ts";
import { openFiles } from "./features/session/openVideo.ts";
import { useAutosave } from "./features/session/useAutosave.ts";
import EpisodeList from "./features/timeline/EpisodeList.tsx";
import Timeline from "./features/timeline/Timeline.tsx";

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

function PlayerColumn() {
  const hasVideo = usePlayerStore((s) => s.source !== null);
  const error = usePlayerStore((s) => s.error);
  const scoresFor = useSessionStore((s) => s.session?.video.fileName);

  if (!hasVideo) {
    return (
      <Alert
        severity="info"
        action={
          <VideoFileButton onFiles={openFiles} color="inherit" size="small">
            Open video
          </VideoFileButton>
        }
      >
        Viewing imported scores{scoresFor ? ` for ${scoresFor}` : ""}. Open the
        video to keep scoring and to jump to episodes.
      </Alert>
    );
  }
  return (
    <>
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <VideoFileButton onFiles={openFiles} color="inherit" size="small">
              Choose another
            </VideoFileButton>
          }
        >
          {error}
        </Alert>
      )}
      <VideoPlayer />
      <PlayerControls />
    </>
  );
}

function Workspace() {
  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 8 }}>
        <PlayerColumn />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <Stack spacing={2}>
          <TriggerPad />
          <TallyTable />
        </Stack>
      </Grid>
      <Grid size={12}>
        <Stack spacing={2}>
          <Timeline />
          <EpisodeList />
        </Stack>
      </Grid>
    </Grid>
  );
}

export default function App() {
  useGlobalKeys();
  useAutosave();
  useWindowFileDrop(openFiles);
  const hasWork = useSessionStore((s) => s.session !== null);
  const settingsOpen = useSettingsDialog((s) => s.open);
  const setSettingsOpen = useSettingsDialog((s) => s.setOpen);

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />
      <Container component="main" maxWidth="xl" sx={{ flex: 1, py: 3 }}>
        {hasWork ? (
          <Workspace />
        ) : (
          <VideoDropZone onFiles={openFiles}>
            <VideoFileButton
              onFiles={openFiles}
              accept=".json,application/json"
            >
              Or open saved scores (JSON)
            </VideoFileButton>
          </VideoDropZone>
        )}
      </Container>
      <AppFooter />
      <Notices />
      {settingsOpen && (
        <BehaviorSettingsDialog
          onClose={() => setSettingsOpen(false)}
          confirmRemoval={confirmBehaviorRemoval}
        />
      )}
      <ConfirmDialog />
    </Box>
  );
}
