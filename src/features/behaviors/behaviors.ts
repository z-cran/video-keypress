import {
  hotkeyLabel,
  isAllowedHotkeyCode,
  legacyKeyToCode,
  type Hotkey
} from "./hotkeys.ts";

export type TriggerMode = "hold" | "toggle";

export interface Behavior {
  id: string;
  name: string;
  color: string;
  hotkey: Hotkey | null;
  mode: TriggerMode;
}

export type NewId = () => string;

/** Okabe-Ito: distinguishable with the common forms of color blindness. */
export const PALETTE: readonly string[] = [
  "#0072B2",
  "#E69F00",
  "#009E73",
  "#CC79A7",
  "#D55E00",
  "#56B4E9",
  "#F0E442",
  "#999999"
];

export const MAX_NAME_LENGTH = 40;

export function defaultBehaviors(newId: NewId): Behavior[] {
  return ["Scratching", "Grooming", "Rearing"].map((name, i) => ({
    id: newId(),
    name,
    color: PALETTE[i]!,
    hotkey: { code: `Digit${i + 1}`, label: String(i + 1) },
    mode: "hold"
  }));
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function sameName(a: string, b: string): boolean {
  return (
    normalizeName(a).toLocaleLowerCase() ===
    normalizeName(b).toLocaleLowerCase()
  );
}

/** Why `name` cannot be used for behavior `selfId`, or null when it can. */
export function nameProblem(
  name: string,
  behaviors: readonly Behavior[],
  selfId: string | null
): string | null {
  const clean = normalizeName(name);
  if (!clean) return "Give this behavior a name.";
  if (clean.length > MAX_NAME_LENGTH) {
    return `Keep the name to ${MAX_NAME_LENGTH} characters or fewer.`;
  }
  const other = behaviors.find(
    (b) => b.id !== selfId && sameName(b.name, clean)
  );
  if (other) return `Another behavior is already called ${other.name}.`;
  return null;
}

export function nextColor(behaviors: readonly Behavior[]): string {
  const used = new Set(behaviors.map((b) => b.color.toUpperCase()));
  return (
    PALETTE.find((c) => !used.has(c.toUpperCase())) ??
    PALETTE[behaviors.length % PALETTE.length]!
  );
}

const DIGIT_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

function freeDigit(behaviors: readonly Behavior[]): Hotkey | null {
  const used = new Set(behaviors.map((b) => b.hotkey?.code));
  const digit = DIGIT_ORDER.find((d) => !used.has(`Digit${d}`));
  return digit ? { code: `Digit${digit}`, label: digit } : null;
}

/** A new behavior with a unique name, an unused color and a free digit key. */
export function createBehavior(
  behaviors: readonly Behavior[],
  newId: NewId
): Behavior {
  let name = "New behavior";
  for (let n = 2; behaviors.some((b) => sameName(b.name, name)); n++) {
    name = `New behavior ${n}`;
  }
  return {
    id: newId(),
    name,
    color: nextColor(behaviors),
    hotkey: freeDigit(behaviors),
    mode: "hold"
  };
}

export function updateBehavior(
  behaviors: readonly Behavior[],
  id: string,
  patch: Partial<Omit<Behavior, "id">>
): Behavior[] {
  return behaviors.map((b) =>
    b.id === id
      ? { ...b, ...patch, name: normalizeName(patch.name ?? b.name) }
      : b
  );
}

export function removeBehavior(
  behaviors: readonly Behavior[],
  id: string
): Behavior[] {
  return behaviors.filter((b) => b.id !== id);
}

/** Move a behavior up (-1) or down (+1). Out-of-range moves change nothing. */
export function moveBehavior(
  behaviors: readonly Behavior[],
  id: string,
  delta: -1 | 1
): Behavior[] {
  const from = behaviors.findIndex((b) => b.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= behaviors.length) return [...behaviors];
  const next = [...behaviors];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

/**
 * Bring behaviors from a saved or imported session into the list. Each
 * incoming behavior matches an existing one by id, then by name; the rest are
 * appended (keeping their hotkey only if it is still free). Returns how
 * incoming ids map to list ids, so episodes can be re-pointed.
 */
export function mergeBehaviors(
  current: readonly Behavior[],
  incoming: readonly Behavior[],
  newId: NewId
): { behaviors: Behavior[]; idMap: Map<string, string>; added: Behavior[] } {
  const behaviors = [...current];
  const idMap = new Map<string, string>();
  const added: Behavior[] = [];

  for (const inc of incoming) {
    const match =
      behaviors.find((b) => b.id === inc.id) ??
      behaviors.find((b) => sameName(b.name, inc.name));
    if (match) {
      idMap.set(inc.id, match.id);
      continue;
    }
    const keyFree =
      inc.hotkey &&
      isAllowedHotkeyCode(inc.hotkey.code) &&
      !behaviors.some((b) => b.hotkey?.code === inc.hotkey?.code);
    const idTaken = !inc.id || behaviors.some((b) => b.id === inc.id);
    const behavior: Behavior = {
      id: idTaken ? newId() : inc.id,
      name: normalizeName(inc.name) || "Unnamed behavior",
      color: /^#[0-9a-f]{6}$/i.test(inc.color)
        ? inc.color
        : nextColor(behaviors),
      hotkey: keyFree ? inc.hotkey : null,
      mode: inc.mode === "toggle" ? "toggle" : "hold"
    };
    behaviors.push(behavior);
    added.push(behavior);
    idMap.set(inc.id, behavior.id);
  }
  return { behaviors, idMap, added };
}

/**
 * v1 kept `[{ id, key, order, behavior, active }]` under localStorage
 * `keybinds`. Returns null when there is nothing usable, so the caller falls
 * back to the defaults.
 */
export function migrateLegacyKeybinds(
  raw: unknown,
  newId: NewId
): Behavior[] | null {
  if (!Array.isArray(raw)) return null;
  const entries = raw
    .filter(
      (e): e is { behavior: string; key?: unknown; order?: unknown } =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as { behavior?: unknown }).behavior === "string"
    )
    .map((e, index) => ({
      name: normalizeName(e.behavior),
      code: legacyKeyToCode(e.key),
      order: typeof e.order === "number" ? e.order : index,
      index
    }))
    .filter((e) => e.name.length > 0)
    .sort((a, b) => a.order - b.order || a.index - b.index);

  const behaviors: Behavior[] = [];
  for (const e of entries) {
    if (behaviors.some((b) => sameName(b.name, e.name))) continue;
    const codeFree =
      e.code && !behaviors.some((b) => b.hotkey?.code === e.code);
    behaviors.push({
      id: newId(),
      name: e.name.slice(0, MAX_NAME_LENGTH),
      color: nextColor(behaviors),
      hotkey:
        codeFree && e.code
          ? { code: e.code, label: hotkeyLabel(e.code, undefined) }
          : null,
      mode: "hold"
    });
  }
  return behaviors.length > 0 ? behaviors : null;
}
