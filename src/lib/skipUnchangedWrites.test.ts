// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  skipUnchangedWrites,
  type KeyValueStorage
} from "./skipUnchangedWrites.ts";

/** An in-memory storage that records every write it receives. */
function recordingStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const writes: [string, string][] = [];
  const storage: KeyValueStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      writes.push([key, value]);
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    }
  };
  return { storage, data, writes };
}

describe("skipUnchangedWrites", () => {
  it("writes a key the storage does not hold yet", () => {
    const { storage, data } = recordingStorage();

    skipUnchangedWrites(storage).setItem("prefs", '{"rate":1}');

    expect(data.get("prefs")).toBe('{"rate":1}');
  });

  it("skips a write when the storage already holds the same value", () => {
    const { storage, writes } = recordingStorage({ prefs: '{"rate":1}' });

    skipUnchangedWrites(storage).setItem("prefs", '{"rate":1}');

    expect(writes).toEqual([]);
  });

  it("writes a changed value", () => {
    const { storage, data } = recordingStorage({ prefs: '{"rate":1}' });

    skipUnchangedWrites(storage).setItem("prefs", '{"rate":1.5}');

    expect(data.get("prefs")).toBe('{"rate":1.5}');
  });

  it("compares each key with its own stored value", () => {
    const { storage, writes } = recordingStorage({ a: "same" });

    skipUnchangedWrites(storage).setItem("b", "same");

    expect(writes).toEqual([["b", "same"]]);
  });

  it("writes again after the key was removed outside the wrapper", () => {
    const { storage, data } = recordingStorage();
    const wrapped = skipUnchangedWrites(storage);
    wrapped.setItem("prefs", "v1");

    data.clear(); // another tab, or the browser clearing site data
    wrapped.setItem("prefs", "v1");

    expect(data.get("prefs")).toBe("v1");
  });

  it.each(["", "null"])("treats %j as a real value to write", (value) => {
    const { storage, data } = recordingStorage();

    skipUnchangedWrites(storage).setItem("prefs", value);

    expect(data.get("prefs")).toBe(value);
  });

  it("passes a failed write through to the caller", () => {
    const full: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
      removeItem: () => {}
    };

    expect(() => skipUnchangedWrites(full).setItem("prefs", "v")).toThrow(
      "quota"
    );
  });

  it("reads from the wrapped storage", () => {
    const { storage } = recordingStorage({ prefs: "v" });

    expect(skipUnchangedWrites(storage).getItem("prefs")).toBe("v");
  });

  it("removes from the wrapped storage", () => {
    const { storage, data } = recordingStorage({ prefs: "v" });

    skipUnchangedWrites(storage).removeItem("prefs");

    expect(data.has("prefs")).toBe(false);
  });
});
