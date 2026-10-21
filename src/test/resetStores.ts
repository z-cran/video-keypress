import type { StoreApi, UseBoundStore } from "zustand";
import { usePlayerStore } from "../features/player/playerStore.ts";
import { useNoticeStore } from "../lib/noticeStore.ts";

function reset<T>(store: UseBoundStore<StoreApi<T>>) {
  store.setState(store.getInitialState(), true);
}

/** Stores are module singletons; give every test a fresh start. */
export function resetStores() {
  reset(usePlayerStore);
  reset(useNoticeStore);
}
