import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import Notices from "../../components/Notices.tsx";
import MediaDiagnostics from "./MediaDiagnostics.tsx";

/**
 * A plain `<video>` with none of the app around it: no stores, no updates
 * ten times a second, no timeline. Playing the same file here and in the app
 * shows whether a stall comes from the browser or from the app (opened with
 * `?mediacheck`). The file input stays mounted and keeps its value, unlike
 * the app's, which clears it after picking and unmounts with the drop zone.
 */
export default function MediaCheck() {
  const [source, setSource] = useState<{ file: File; url: string } | null>(
    null
  );
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);

  return (
    <Container component="main" maxWidth="md" sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          Media check
        </Typography>
        <Typography color="text.secondary">
          A plain video player for comparing playback with Video Keypress.
          Choose the same video you use in the app and press play. If it stops,
          copy the report and send it with the one from the app.
        </Typography>
        <Box>
          <Button component="label" nativeButton={false} variant="contained">
            Choose a video
            <input
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (!file) return;
                if (source) URL.revokeObjectURL(source.url);
                setSource({ file, url: URL.createObjectURL(file) });
              }}
            />
          </Button>
        </Box>
        {source && (
          <video
            ref={setVideo}
            src={source.url}
            aria-label="Video"
            controls
            playsInline
            style={{
              display: "block",
              width: "100%",
              maxHeight: "65vh",
              backgroundColor: "black"
            }}
          />
        )}
        <MediaDiagnostics
          el={video}
          file={source?.file ?? null}
          page="bare player"
        />
        <Link href="./">Back to Video Keypress</Link>
      </Stack>
      <Notices />
    </Container>
  );
}
