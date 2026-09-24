export type ImportDraft = {
  title: string;
  artist: string;
  durationMs: number;
  mode: "video" | "audio";
  useDuration: boolean;
  note: string;
};

export type ProbeResult = { ok: true; draft: ImportDraft } | { ok: false; error: string };

export type SaveRequest = {
  title: string;
  artist: string;
  durationMs: number;
  mode: "video" | "audio";
  lockTitle: boolean;
  lockArtist: boolean;
};

export type SaveResult =
  | { ok: true; projectPath: string; mediaPath: string }
  | { ok: false; error: string };
