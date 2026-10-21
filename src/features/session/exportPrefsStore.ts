import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  EPISODE_COLUMNS,
  pickColumns,
  SUMMARY_COLUMNS,
  type EpisodeColumn,
  type SummaryColumn
} from "./sessionFormat.ts";

export type CsvKind = "episodes" | "summary";

interface ExportPrefsState {
  episodeColumns: EpisodeColumn[];
  summaryColumns: SummaryColumn[];
  setEpisodeColumns: (columns: EpisodeColumn[]) => void;
  setSummaryColumns: (columns: SummaryColumn[]) => void;
}

/** The CSV columns each researcher last exported, remembered in this browser. */
export const useExportPrefs = create<ExportPrefsState>()(
  persist(
    (set) => ({
      episodeColumns: EPISODE_COLUMNS.map((c) => c.id),
      summaryColumns: SUMMARY_COLUMNS.map((c) => c.id),
      setEpisodeColumns: (columns) =>
        set({ episodeColumns: pickColumns(EPISODE_COLUMNS, columns) }),
      setSummaryColumns: (columns) =>
        set({ summaryColumns: pickColumns(SUMMARY_COLUMNS, columns) })
    }),
    {
      name: "video-keypress:export",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        episodeColumns: s.episodeColumns,
        summaryColumns: s.summaryColumns
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        return {
          ...current,
          episodeColumns: pickColumns(EPISODE_COLUMNS, p.episodeColumns),
          summaryColumns: pickColumns(SUMMARY_COLUMNS, p.summaryColumns)
        };
      }
    }
  )
);
