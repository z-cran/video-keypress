import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { newId } from "../../lib/id.ts";
import {
  defaultBehaviors,
  mergeBehaviors,
  migrateLegacyKeybinds,
  sanitizeBehaviors,
  type Behavior
} from "./behaviors.ts";

/** Where v1 kept its keybinds. Read once, never written. */
export const LEGACY_KEYBINDS_KEY = "keybinds";

interface BehaviorsState {
  behaviors: Behavior[];
  setBehaviors: (behaviors: Behavior[]) => void;
  /** Add behaviors from a session that the list does not have yet. */
  mergeIn: (incoming: readonly Behavior[]) => {
    idMap: Map<string, string>;
    added: Behavior[];
  };
  resetToDefaults: () => void;
}

function readLegacyKeybinds(): Behavior[] | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEYBINDS_KEY);
    return raw ? migrateLegacyKeybinds(JSON.parse(raw), newId) : null;
  } catch {
    return null; // corrupt v1 data: fall back to the defaults
  }
}

export const useBehaviorsStore = create<BehaviorsState>()(
  persist(
    (set, get) => ({
      behaviors: defaultBehaviors(newId),
      setBehaviors: (behaviors) => set({ behaviors }),
      mergeIn: (incoming) => {
        const { behaviors, idMap, added } = mergeBehaviors(
          get().behaviors,
          incoming,
          newId
        );
        if (added.length > 0) set({ behaviors });
        return { idMap, added };
      },
      resetToDefaults: () => set({ behaviors: defaultBehaviors(newId) })
    }),
    {
      name: "video-keypress:behaviors",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ behaviors: s.behaviors }),
      merge: (persisted, current) => {
        const stored = (persisted as { behaviors?: unknown } | undefined)
          ?.behaviors;
        // An empty list is a deliberate choice; only missing data gets defaults.
        const behaviors =
          stored === undefined
            ? readLegacyKeybinds()
            : Array.isArray(stored) && stored.length === 0
              ? []
              : sanitizeBehaviors(stored, newId);
        return { ...current, behaviors: behaviors ?? current.behaviors };
      }
    }
  )
);
