/** The part of `Storage` that zustand's `createJSONStorage` calls. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Wrap a storage so `setItem` does nothing when the key already holds that
 * exact value. zustand's `persist` writes on every `setState`, and the player
 * store updates `currentTime` about ten times a second, so the unchanged
 * speed and mute prefs were rewritten to localStorage roughly 14 times a
 * second during playback. Comparing with what is stored, rather than with
 * the last value written, stays correct when another tab or a reset changes
 * the key behind this wrapper's back.
 */
export function skipUnchangedWrites(storage: KeyValueStorage): KeyValueStorage {
  return {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => {
      if (storage.getItem(key) === value) return;
      storage.setItem(key, value);
    },
    removeItem: (key) => storage.removeItem(key)
  };
}
