import Box from "@mui/material/Box";
import { useEffect, useRef } from "react";
import { notify } from "../../lib/noticeStore.ts";
import { mediaErrorMessage } from "./playback.ts";
import { usePlayerStore } from "./playerStore.ts";

/** How often the displayed time updates while playing. */
const DISPLAY_INTERVAL_MS = 100;

export default function VideoPlayer() {
  const url = usePlayerStore((s) => s.source?.url);
  const toggle = usePlayerStore((s) => s.toggle);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const store = usePlayerStore.getState;
    store().setElement(el);

    let fixingDuration = false;
    let frame = 0;
    let lastShown = 0;

    const sync = () => store().syncFromElement();

    const tick = (now: number) => {
      if (now - lastShown >= DISPLAY_INTERVAL_MS) {
        lastShown = now;
        if (el.currentTime !== store().currentTime) {
          usePlayerStore.setState({ currentTime: el.currentTime });
        }
      }
      frame = requestAnimationFrame(tick);
    };

    const onLoadedMetadata = () => {
      // Recordings from MediaRecorder report an Infinity duration until the
      // browser has seen the end of the file. Seeking far ahead makes it look.
      if (el.duration === Number.POSITIVE_INFINITY) {
        fixingDuration = true;
        el.currentTime = Number.MAX_SAFE_INTEGER;
      }
      if (el.videoWidth === 0) {
        notify("This file has no picture. You can still score it by sound.", {
          severity: "warning"
        });
      }
      store().setError(null);
      sync();
    };
    const onDurationChange = () => {
      if (fixingDuration && Number.isFinite(el.duration)) {
        fixingDuration = false;
        el.currentTime = 0;
      }
      sync();
    };
    const onPlay = () => {
      sync();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    };
    const onPause = () => {
      cancelAnimationFrame(frame);
      sync();
    };
    const onError = () => {
      store().setError(mediaErrorMessage(el.error?.code ?? 0));
    };

    const listeners: [string, () => void][] = [
      ["loadedmetadata", onLoadedMetadata],
      ["durationchange", onDurationChange],
      ["play", onPlay],
      ["pause", onPause],
      ["ended", onPause],
      ["seeked", sync],
      ["timeupdate", sync],
      ["emptied", sync],
      ["error", onError]
    ];
    for (const [type, fn] of listeners) el.addEventListener(type, fn);
    return () => {
      for (const [type, fn] of listeners) el.removeEventListener(type, fn);
      cancelAnimationFrame(frame);
      store().setElement(null);
    };
  }, []);

  return (
    <Box
      sx={{
        bgcolor: "common.black",
        borderRadius: 2,
        overflow: "hidden",
        lineHeight: 0
      }}
    >
      <video
        ref={videoRef}
        src={url}
        aria-label="Video"
        preload="metadata"
        playsInline
        onClick={toggle}
        style={{
          display: "block",
          width: "100%",
          maxHeight: "65vh",
          cursor: "pointer"
        }}
      />
    </Box>
  );
}
