import type { PreviewSession } from "./preview";

export type LyricHit = {
  key: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  deltaMs: number | null;
  score: number;
};

export type PickList = {
  title: string;
  artist: string;
  durationMs: number;
  reason: string;
  hits: LyricHit[];
};

export type MatchResult =
  | { kind: "preview"; session: PreviewSession }
  | { kind: "pick"; session: PreviewSession; pick: PickList };
