import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import Link from "@mui/material/Link";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import Notices from "../../components/Notices.tsx";
import MediaDiagnostics from "./MediaDiagnostics.tsx";
import { openVideoStream, type VideoStream } from "./videoStreamClient.ts";

type LoadWith = "worker" | "blob";

/**
 * A plain `<video>` with none of the app around it: no stores, no updates
 * ten times a second, no timeline. Playing the same file here and in the app
 * shows whether a stall comes from the browser or from the app (opened with
 * `?mediacheck`). The file input stays mounted and keeps its value, unlike
 * the app's, which clears it after picking and unmounts with the drop zone.
 * "Load with" compares the service worker (ADR-017) with a plain blob URL.
 */
export default function MediaCheck() {
  const [loadWith, setLoadWith] = useState<LoadWith>("worker");
  const [source, setSource] = useState<({ file: File } & VideoStream) | null>(
    null
  );
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);

  const load = (file: File, how: LoadWith) => {
    source?.release();
    setSource({
      file,
      ...openVideoStream(file, { preferBlob: how === "blob" })
    });
  };

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
        <FormControl>
          <FormLabel id="load-with-label">Load with</FormLabel>
          <RadioGroup
            row
            aria-labelledby="load-with-label"
            value={loadWith}
            onChange={(e) => {
              const how = e.target.value as LoadWith;
              setLoadWith(how);
              if (source) load(source.file, how);
            }}
          >
            <FormControlLabel
              value="worker"
              control={<Radio />}
              label="Service worker when available"
            />
            <FormControlLabel
              value="blob"
              control={<Radio />}
              label="Blob URL"
            />
          </RadioGroup>
        </FormControl>
        <Box>
          <Button component="label" nativeButton={false} variant="contained">
            Choose a video
            <input
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) load(file, loadWith);
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
          source={source?.via ?? null}
          page="bare player"
        />
        <Link href="./">Back to Video Keypress</Link>
      </Stack>
      <Notices />
    </Container>
  );
}
