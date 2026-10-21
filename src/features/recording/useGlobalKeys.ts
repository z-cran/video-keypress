import { useEffect } from "react";
import { notify } from "../../lib/noticeStore.ts";
import {
  resolveKey,
  type KeyLike,
  type PlayerAction
} from "../behaviors/hotkeys.ts";
import { FINE_SEEK_STEP, formatRate, SEEK_STEP } from "../player/playback.ts";
import { usePlayerStore } from "../player/playerStore.ts";

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
    const onKeyDown = (ev: KeyboardEvent) => {
      if (!usePlayerStore.getState().ready) return;
      const resolved = resolveKey(toKeyLike(ev), [], "down");
      if (resolved.kind === "player") {
        ev.preventDefault();
        ev.stopPropagation();
        if (resolved.action) runPlayerAction(resolved.action);
      }
    };

    const onKeyUp = (ev: KeyboardEvent) => {
      if (!usePlayerStore.getState().ready) return;
      const resolved = resolveKey(toKeyLike(ev), [], "up");
      if (resolved.kind === "player") {
        ev.preventDefault();
        ev.stopPropagation();
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
    };
  }, []);
}
