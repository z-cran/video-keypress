// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Behavior } from "../behaviors/behaviors.ts";
import {
  createSessionRepo,
  parseStoredSession,
  SESSION_PREFIX
} from "./savedSessions.ts";
import type { Session } from "./session.ts";

/** In-memory Storage that throws like a browser once `limit` chars are used. */
class FakeStorage implements Storage {
  private items = new Map<string, string>();
  private limit: number;
  constructor(limit = Infinity) {
    this.limit = limit;
  }
  get length() {
    return this.items.size;
  }
  key(i: number) {
    return [...this.items.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.items.get(k) ?? null;
  }
  removeItem(k: string) {
    this.items.delete(k);
  }
  clear() {
    this.items.clear();
  }
  setItem(k: string, v: string) {
    const used = [...this.items].reduce(
      (n, [key, val]) => (key === k ? n : n + key.length + val.length),
      0
    );
    if (used + k.length + v.length > this.limit) {
      throw new DOMException("full", "QuotaExceededError");
    }
    this.items.set(k, v);
  }
}

const ids = () => {
  let n = 0;
  return () => `new${++n}`;
};

const scratching: Behavior = {
  id: "b1",
  name: "Scratching",
  color: "#0072B2",
  hotkey: { code: "Digit1", label: "1" },
  mode: "hold"
};

function session(
  fingerprint: string,
  updatedAt: number,
  episodeCount = 1
): Session {
  return {
    version: 2,
    fingerprint,
    video: {
      fileName: `${fingerprint}.mp4`,
      size: 10,
      lastModified: 1,
      duration: 60
    },
    createdAt: 1,
    updatedAt,
    behaviors: [scratching],
    episodes: Array.from({ length: episodeCount }, (_, i) => ({
      id: `e${i}`,
      behaviorId: "b1",
      start: i,
      end: i + 0.5
    }))
  };
}

describe("session repository", () => {
  it("saves under a namespaced key and loads the same session back", () => {
    const storage = new FakeStorage();
    const repo = createSessionRepo(storage, ids());

    expect(repo.save(session("a", 5))).toBe("saved");

    expect(storage.key(0)).toBe(`${SESSION_PREFIX}a`);
    expect(repo.load("a")).toEqual(session("a", 5));
  });

  it("returns null for a session that was never saved", () => {
    expect(
      createSessionRepo(new FakeStorage(), ids()).load("missing")
    ).toBeNull();
  });

  it("returns null for an entry that is not JSON", () => {
    const storage = new FakeStorage();
    storage.setItem(`${SESSION_PREFIX}a`, "{oops");
    expect(createSessionRepo(storage, ids()).load("a")).toBeNull();
  });

  it("removes the oldest other session when storage is full, then saves", () => {
    const sizeOf = (s: Session) =>
      `${SESSION_PREFIX}${s.fingerprint}`.length + JSON.stringify(s).length;
    const [old, newer, current] = [
      session("old", 1),
      session("newer", 2),
      session("current", 3, 4)
    ];
    // Room for two of the three sessions.
    const storage = new FakeStorage(sizeOf(newer) + sizeOf(current) + 10);
    const repo = createSessionRepo(storage, ids());
    repo.save(old);
    repo.save(newer);

    const result = repo.save(current);

    expect(result).toBe("evicted");
    expect(repo.list().map((s) => s.fingerprint)).toEqual(["newer", "current"]);
  });

  it("reports full when even an empty store cannot hold the session", () => {
    const repo = createSessionRepo(new FakeStorage(100), ids());
    expect(repo.save(session("big", 1, 50))).toBe("full");
    expect(repo.load("big")).toBeNull();
  });

  it("does not save a read-only session without a fingerprint", () => {
    const storage = new FakeStorage();
    const readOnly = { ...session("x", 1), fingerprint: null };
    expect(createSessionRepo(storage, ids()).save(readOnly)).toBe("full");
    expect(storage.length).toBe(0);
  });

  it("lists sessions oldest first and ignores other keys", () => {
    const storage = new FakeStorage();
    storage.setItem("video-keypress:behaviors", "{}");
    const repo = createSessionRepo(storage, ids());
    repo.save(session("b", 9, 2));
    repo.save(session("a", 3));

    expect(repo.list()).toEqual([
      { fingerprint: "a", fileName: "a.mp4", updatedAt: 3, episodes: 1 },
      { fingerprint: "b", fileName: "b.mp4", updatedAt: 9, episodes: 2 }
    ]);
  });
});

describe("parseStoredSession", () => {
  it("drops episodes with bad times or unknown behaviors and orders the rest", () => {
    const raw = {
      ...session("a", 1),
      episodes: [
        { id: "late", behaviorId: "b1", start: 9, end: 8 },
        { id: "nan", behaviorId: "b1", start: Number.NaN, end: 1 },
        { id: "neg", behaviorId: "b1", start: -1, end: 1 },
        { id: "ghost", behaviorId: "zz", start: 1, end: 2 },
        { id: "early", behaviorId: "b1", start: 2, end: 3 },
        null
      ]
    };
    expect(parseStoredSession(raw, ids())?.episodes).toEqual([
      { id: "early", behaviorId: "b1", start: 2, end: 3 },
      { id: "late", behaviorId: "b1", start: 8, end: 9 }
    ]);
  });

  it.each([
    ["null", null],
    ["a string", "session"],
    ["version 1", { ...session("a", 1), version: 1 }],
    ["no fingerprint", { ...session("a", 1), fingerprint: null }],
    ["no episodes list", { ...session("a", 1), episodes: "none" }],
    ["no video", { ...session("a", 1), video: undefined }]
  ])("rejects %s", (_label, raw) => {
    expect(parseStoredSession(raw, ids())).toBeNull();
  });

  it("keeps an unknown duration as NaN rather than zero", () => {
    const raw = {
      ...session("a", 1),
      video: { fileName: "a.mp4", duration: null }
    };
    expect(parseStoredSession(raw, ids())?.video.duration).toBeNaN();
  });
});
