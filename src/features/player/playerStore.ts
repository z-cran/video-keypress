import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { notify } from "../../lib/noticeStore.ts";
import { FRAME_STEP, seekTarget, snapRate, stepRate } from "./playback.ts";

export interface VideoSource {
  file: File;
  url: string;
}

interface PlayerState {
  el: HTMLVideoElement | null;
  source: VideoSource | null;
  /** Metadata loaded: `duration` and `currentTime` mean something. */
  ready: boolean;
  paused: boolean;
  /** NaN until known. */
  duration: number;
  /** For display only, updated about 10 times a second. Record with getTime(). */
  currentTime: number;
  rate: number;
  muted: boolean;
  error: string | null;

  setElement: (el: HTMLVideoElement | null) => void;
  openFile: (file: File) => void;
  closeVideo: () => void;
  syncFromElement: () => void;
  setError: (message: string | null) => void;

  /** The exact current time, read from the element. Use this to record. */
  getTime: () => number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (t: number) => void;
  seekBy: (delta: number) => void;
  stepFrame: (direction: 1 | -1) => void;
  setRate: (rate: number) => void;
  stepRate: (direction: 1 | -1) => void;
  setMuted: (muted: boolean) => void;
}

const initialMedia = {
  ready: false,
  paused: true,
  duration: Number.NaN,
  currentTime: 0,
  error: null
};

function applyRate(el: HTMLVideoElement, rate: number) {
  // Loading a new file resets playbackRate to defaultPlaybackRate.
  el.defaultPlaybackRate = rate;
  el.playbackRate = rate;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      el: null,
      source: null,
      ...initialMedia,
      rate: 1,
      muted: false,

      setElement: (el) => {
        if (el) {
          applyRate(el, get().rate);
          el.muted = get().muted;
        }
        set({ el });
      },

      openFile: (file) => {
        const previous = get().source;
        if (previous) URL.revokeObjectURL(previous.url);
        get().el?.pause();
        set({
          source: { file, url: URL.createObjectURL(file) },
          ...initialMedia
        });
      },

      closeVideo: () => {
        const previous = get().source;
        if (previous) URL.revokeObjectURL(previous.url);
        get().el?.pause();
        set({ source: null, ...initialMedia });
      },

      syncFromElement: () => {
        const el = get().el;
        if (!el) return;
        set({
          ready: el.readyState >= 1,
          paused: el.paused,
          duration: el.duration,
          currentTime: el.currentTime
        });
      },

      setError: (error) => set({ error }),

      getTime: () => get().el?.currentTime ?? Number.NaN,

      play: () => {
        const el = get().el;
        if (!el || !get().ready) return;
        el.play().catch((err: unknown) => {
          // Autoplay policy or a decode problem; without a message the
          // button would look like it did nothing.
          if (err instanceof Error && err.name === "AbortError") return; // a pause() won the race
          notify(
            "The video could not start playing. Try pressing play again.",
            {
              severity: "warning"
            }
          );
        });
      },

      pause: () => get().el?.pause(),

      toggle: () => {
        const el = get().el;
        if (!el) return;
        if (el.paused) get().play();
        else el.pause();
      },

      seek: (t) => {
        const el = get().el;
        if (!el || !get().ready) return;
        const target = seekTarget(t, 0, el.duration);
        el.currentTime = target;
        set({ currentTime: target });
      },

      seekBy: (delta) => {
        const el = get().el;
        if (!el) return;
        get().seek(seekTarget(el.currentTime, delta, el.duration));
      },

      stepFrame: (direction) => {
        const el = get().el;
        if (!el) return;
        el.pause();
        get().seekBy(direction * FRAME_STEP);
      },

      setRate: (rate) => {
        const next = snapRate(rate);
        const el = get().el;
        if (el) applyRate(el, next);
        set({ rate: next });
      },

      stepRate: (direction) => get().setRate(stepRate(get().rate, direction)),

      setMuted: (muted) => {
        const el = get().el;
        if (el) el.muted = muted;
        set({ muted });
      }
    }),
    {
      name: "video-keypress:prefs",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ rate: s.rate, muted: s.muted }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { rate?: unknown; muted?: unknown };
        return {
          ...current,
          rate: snapRate(p.rate ?? current.rate),
          muted: typeof p.muted === "boolean" ? p.muted : current.muted
        };
      }
    }
  )
);
