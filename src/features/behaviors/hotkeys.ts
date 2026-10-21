export interface Hotkey {
  /** `KeyboardEvent.code`, e.g. `Digit1`, `KeyS`, `Numpad3`. */
  code: string;
  /** What the key showed when it was bound, e.g. `1`, `S`. */
  label: string;
}

export type PlayerAction =
  | "togglePlay"
  | "seekBack"
  | "seekForward"
  | "fineSeekBack"
  | "fineSeekForward"
  | "frameBack"
  | "frameForward"
  | "slower"
  | "faster";

/** Keys the player owns. They can never be bound to a behavior. */
export const RESERVED_CODES: ReadonlyMap<string, string> = new Map([
  ["Space", "Space plays and pauses the video"],
  ["ArrowLeft", "The left arrow seeks back"],
  ["ArrowRight", "The right arrow seeks forward"],
  ["Comma", "Comma steps back one frame"],
  ["Period", "Period steps forward one frame"]
]);

/** Actions that make sense to repeat while the key is held down. */
const REPEATABLE = new Set<PlayerAction>([
  "seekBack",
  "seekForward",
  "fineSeekBack",
  "fineSeekForward",
  "frameBack",
  "frameForward"
]);

const META_CODES = new Set(["MetaLeft", "MetaRight", "OSLeft", "OSRight"]);

export function isAllowedHotkeyCode(code: string): boolean {
  return /^(Key[A-Z]|Digit[0-9]|Numpad[0-9])$/.test(code);
}

/** Label derived from the physical key when the typed character is unusable. */
export function codeLabel(code: string): string {
  const match = /^(?:Key|Digit)(.)$/.exec(code);
  if (match) return match[1]!;
  const numpad = /^Numpad([0-9])$/.exec(code);
  if (numpad) return `Num ${numpad[1]}`;
  return code;
}

/** Prefer the character the key typed (layout aware), else the code label. */
export function hotkeyLabel(code: string, key: string | undefined): string {
  if (code.startsWith("Numpad")) return codeLabel(code);
  if (key && key.length === 1 && /[\p{L}\p{N}]/u.test(key)) {
    return key.toUpperCase();
  }
  return codeLabel(code);
}

/** v1 stored the typed character (`"1"`, `"a"`); map it to a code. */
export function legacyKeyToCode(key: unknown): string | null {
  if (typeof key !== "string" || key.length !== 1) return null;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  return null;
}

interface HotkeyOwner {
  id: string;
  name: string;
  hotkey: Hotkey | null;
}

/**
 * Why a key cannot be bound to the behavior `selfId`, as a gentle sentence,
 * or null when it can.
 */
export function hotkeyProblem(
  code: string,
  behaviors: readonly HotkeyOwner[],
  selfId: string | null
): string | null {
  const reserved = RESERVED_CODES.get(code);
  if (reserved) return `${reserved}. Choose a letter or number key.`;
  if (!isAllowedHotkeyCode(code)) return "Choose a letter or number key.";
  const owner = behaviors.find(
    (b) => b.id !== selfId && b.hotkey?.code === code
  );
  if (owner) {
    return `${codeLabel(code)} is already used by ${owner.name}. Choose another key.`;
  }
  return null;
}

/** The parts of a KeyboardEvent the resolver needs, so it runs without a DOM. */
export interface KeyLike {
  code: string;
  key: string;
  repeat: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing: boolean;
  /** The event came from a text field or from inside a dialog or menu. */
  fromIgnoredTarget: boolean;
}

export type KeyResolution =
  /** Reserved key: stop it from reaching the page. `action` null means swallow only. */
  | { kind: "player"; action: PlayerAction | null }
  | { kind: "behavior"; behaviorId: string }
  /** Keyups after this may never arrive (macOS drops them while Cmd is held). */
  | { kind: "releaseKeyHolds" }
  | { kind: "ignore" };

function playerAction(code: string, shift: boolean): PlayerAction | null {
  switch (code) {
    case "Space":
      return "togglePlay";
    case "ArrowLeft":
      return shift ? "fineSeekBack" : "seekBack";
    case "ArrowRight":
      return shift ? "fineSeekForward" : "seekForward";
    case "Comma":
      return shift ? "slower" : "frameBack";
    case "Period":
      return shift ? "faster" : "frameForward";
    default:
      return null;
  }
}

/**
 * Decide what a keydown or keyup means. Keydowns are strict (no modifiers,
 * no repeats, not while typing). Keyups only need to find the behavior, so a
 * hold always ends even if Shift or Ctrl went down in the middle.
 */
export function resolveKey(
  ev: KeyLike,
  behaviors: readonly Pick<HotkeyOwner, "id" | "hotkey">[],
  phase: "down" | "up"
): KeyResolution {
  const behavior = behaviors.find((b) => b.hotkey?.code === ev.code);

  if (phase === "up") {
    if (behavior) return { kind: "behavior", behaviorId: behavior.id };
    if (RESERVED_CODES.has(ev.code) && !ev.fromIgnoredTarget) {
      return { kind: "player", action: null };
    }
    return { kind: "ignore" };
  }

  if (META_CODES.has(ev.code)) return { kind: "releaseKeyHolds" };
  if (ev.fromIgnoredTarget) return { kind: "ignore" };
  if (ev.isComposing || ev.key === "Process" || ev.key === "Dead") {
    return { kind: "ignore" };
  }
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return { kind: "ignore" };

  const action = playerAction(ev.code, ev.shiftKey);
  if (action) {
    const allowed = !ev.repeat || REPEATABLE.has(action);
    return { kind: "player", action: allowed ? action : null };
  }
  if (behavior && !ev.repeat) {
    return { kind: "behavior", behaviorId: behavior.id };
  }
  return { kind: "ignore" };
}
