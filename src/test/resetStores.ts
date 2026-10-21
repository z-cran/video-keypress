import type { StoreApi, UseBoundStore } from "zustand";
import { useBehaviorsStore } from "../features/behaviors/behaviorsStore.ts";
import { useSettingsDialog } from "../features/behaviors/settingsDialogStore.ts";
import { usePlayerStore } from "../features/player/playerStore.ts";
import { useSessionStore } from "../features/recording/sessionStore.ts";
import { useExportPrefs } from "../features/session/exportPrefsStore.ts";
import { useConfirmStore } from "../lib/confirmStore.ts";
import { useNoticeStore } from "../lib/noticeStore.ts";

function reset<T>(store: UseBoundStore<StoreApi<T>>) {
  store.setState(store.getInitialState(), true);
}

/** Stores are module singletons; give every test a fresh start. */
export function resetStores() {
  reset(usePlayerStore);
  reset(useNoticeStore);
  reset(useBehaviorsStore);
  reset(useSettingsDialog);
  reset(useSessionStore);
  reset(useConfirmStore);
  reset(useExportPrefs);
}
