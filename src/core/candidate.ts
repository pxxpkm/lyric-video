export type LyricSource = "網易雲" | "QQ" | "酷狗" | "LRCLIB";

export type LyricCandidate = {
  key: string;
  source: LyricSource;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  hasWords: boolean;
};

export function candidate(partial: Omit<LyricCandidate, "album" | "hasWords"> & Partial<LyricCandidate>): LyricCandidate {
  return {
    album: "",
    hasWords: false,
    ...partial,
  };
}
