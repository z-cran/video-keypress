import { act } from "@testing-library/react";

/**
 * jsdom cannot play media: `play()` and `pause()` are not implemented and
 * `duration`, `paused` and `readyState` are read-only. These fakes keep that
 * state per element so tests can drive a <video> like a browser would.
 */
interface FakeMedia {
  paused: boolean;
  duration: number;
  readyState: number;
  videoWidth: number;
  error: MediaError | null;
}

const states = new WeakMap<HTMLMediaElement, FakeMedia>();

function stateOf(el: HTMLMediaElement): FakeMedia {
  let state = states.get(el);
  if (!state) {
    state = {
      paused: true,
      duration: Number.NaN,
      readyState: 0,
      videoWidth: 0,
      error: null
    };
    states.set(el, state);
  }
  return state;
}

function getter<K extends keyof FakeMedia>(key: K) {
  return {
    configurable: true,
    get(this: HTMLMediaElement) {
      return stateOf(this)[key];
    }
  };
}

export function installMediaFakes() {
  const media = HTMLMediaElement.prototype;
  Object.defineProperty(media, "paused", getter("paused"));
  Object.defineProperty(media, "duration", getter("duration"));
  Object.defineProperty(media, "readyState", getter("readyState"));
  Object.defineProperty(media, "error", getter("error"));
  Object.defineProperty(
    HTMLVideoElement.prototype,
    "videoWidth",
    getter("videoWidth")
  );

  media.play = function play(this: HTMLMediaElement) {
    const state = stateOf(this);
    if (state.paused) {
      state.paused = false;
      this.dispatchEvent(new Event("play"));
      this.dispatchEvent(new Event("playing"));
    }
    return Promise.resolve();
  };
  media.pause = function pause(this: HTMLMediaElement) {
    const state = stateOf(this);
    if (!state.paused) {
      state.paused = true;
      this.dispatchEvent(new Event("pause"));
    }
  };
  media.load = function load() {};
}

/** Finish loading: the browser now knows the duration and size. */
export function loadMetadata(
  video: HTMLVideoElement,
  {
    duration = 60,
    videoWidth = 640
  }: { duration?: number; videoWidth?: number } = {}
) {
  const state = stateOf(video);
  state.duration = duration;
  state.videoWidth = videoWidth;
  state.readyState = 4;
  act(() => {
    video.dispatchEvent(new Event("loadedmetadata"));
    video.dispatchEvent(new Event("durationchange"));
    video.dispatchEvent(new Event("canplay"));
  });
}

/** Move the playhead, as playback or a seek would. */
export function setTime(video: HTMLMediaElement, seconds: number) {
  act(() => {
    video.currentTime = seconds;
    video.dispatchEvent(new Event("timeupdate"));
  });
}

export function failToLoad(video: HTMLMediaElement, code: number) {
  stateOf(video).error = { code, message: "" } as MediaError;
  act(() => {
    video.dispatchEvent(new Event("error"));
  });
}
