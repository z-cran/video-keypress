import { useEffect } from "react";
import { notify } from "../../lib/noticeStore.ts";
import { useBehaviorsStore } from "../behaviors/behaviorsStore.ts";
import {
  resolveKey,
  type KeyLike,
  type PlayerAction
} from "../behaviors/hotkeys.ts";
import { FINE_SEEK_STEP, formatRate, SEEK_STEP } from "../player/playback.ts";
import { usePlayerStore } from "../player/playerStore.ts";
import { useSessionStore } from "./sessionStore.ts";

const OVERLAY = '[role="dialog"], [role="menu"], [role="listbox"]';
const NON_TEXT_INPUTS = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "radio",
  "range",
  "reset",
  "submit"
]);

/** Keys typed here belong to the field or the open dialog, not the player. */
export function isIgnoredTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(OVERLAY)) return true;
  if (target instanceof HTMLInputElement)
    return !NON_TEXT_INPUTS.has(target.type);
  if (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return target.closest('[role="textbox"], [contenteditable="true"]') !== null;
}

export function toKeyLike(ev: KeyboardEvent): KeyLike {
  return {
    code: ev.code,
    key: ev.key,
    repeat: ev.repeat,
    shiftKey: ev.shiftKey,
    ctrlKey: ev.ctrlKey,
    metaKey: ev.metaKey,
    altKey: ev.altKey,
    isComposing: ev.isComposing,
    fromIgnoredTarget: isIgnoredTarget(ev.target)
  };
}

function runPlayerAction(action: PlayerAction) {
  const player = usePlayerStore.getState();
  switch (action) {
    case "togglePlay":
      return player.toggle();
    case "seekBack":
      return player.seekBy(-SEEK_STEP);
    case "seekForward":
      return player.seekBy(SEEK_STEP);
    case "fineSeekBack":
      return player.seekBy(-FINE_SEEK_STEP);
    case "fineSeekForward":
      return player.seekBy(FINE_SEEK_STEP);
    case "frameBack":
      return player.stepFrame(-1);
    case "frameForward":
      return player.stepFrame(1);
    case "slower":
    case "faster":
      player.stepRate(action === "faster" ? 1 : -1);
      notify(`Speed ${formatRate(usePlayerStore.getState().rate)}`);
      return;
  }
}

/**
 * The one window-level key listener. It runs in the capture phase so that
 * reserved player keys never reach a focused button: MUI 9 turns Space on a
 * button into a bubbling click, which would also toggle playback.
 */
export function useGlobalKeys() {
  useEffect(() => {
    const session = useSessionStore.getState;

    const onKeyDown = (ev: KeyboardEvent) => {
      // Before a video loads, keys keep their normal page behavior.
      if (!usePlayerStore.getState().ready) return;
      const { behaviors } = useBehaviorsStore.getState();
      const resolved = resolveKey(toKeyLike(ev), behaviors, "down");
      switch (resolved.kind) {
        case "player":
          ev.preventDefault();
          ev.stopPropagation();
          if (resolved.action) runPlayerAction(resolved.action);
          return;
        case "behavior": {
          const behavior = behaviors.find((b) => b.id === resolved.behaviorId);
          ev.preventDefault();
          if (behavior) session().press(behavior, "key");
          return;
        }
        case "releaseKeyHolds":
          session().releaseKeyHolds();
          return;
        case "ignore":
          return;
      }
    };

    const onKeyUp = (ev: KeyboardEvent) => {
      const { behaviors } = useBehaviorsStore.getState();
      const resolved = resolveKey(toKeyLike(ev), behaviors, "up");
      if (resolved.kind === "behavior") {
        session().release(resolved.behaviorId, "key");
      } else if (
        resolved.kind === "player" &&
        usePlayerStore.getState().ready
      ) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    };

    // Keyups are lost when focus leaves the window or moves into a dialog,
    // so an open hold would never end.
    const releaseKeyHolds = () => session().releaseKeyHolds();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") releaseKeyHolds();
    };
    const onFocusIn = (ev: FocusEvent) => {
      if (ev.target instanceof Element && ev.target.closest(OVERLAY)) {
        releaseKeyHolds();
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    window.addEventListener("blur", releaseKeyHolds);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
      window.removeEventListener("blur", releaseKeyHolds);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, []);
}
