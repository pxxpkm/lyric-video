import { searchArtist, searchTitle } from "./title";
import { usableTrackDuration } from "./lyrics";
import { exampleProject, type Project } from "./project";

export const LONG_TRACK_MS = 12 * 60_000;

export const LONG_TRACK_NOTE = "片長超過 12 分鐘，不用來對歌詞，預設只取音訊。";

export type ImportDraft = {
  title: string;
  artist: string;
  durationMs: number;
  mode: "video" | "audio";
  useDuration: boolean;
  note: string;
};

export function titleFromFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  return base.replace(/\.[^.]+$/, "");
}

export function planImport(
  meta: { rawTitle: string; rawArtist: string; durationMs: number | null },
  locks: { lockTitle: boolean; lockArtist: boolean; title: string; artist: string },
): ImportDraft {
  const durationMs = meta.durationMs != null && meta.durationMs > 0 ? Math.round(meta.durationMs) : 0;
  const long = durationMs >= LONG_TRACK_MS;
  return {
    title: locks.lockTitle ? locks.title : searchTitle(meta.rawTitle),
    artist: locks.lockArtist ? locks.artist : searchArtist(meta.rawTitle, meta.rawArtist),
    durationMs,
    mode: long ? "audio" : "video",
    useDuration: usableTrackDuration(durationMs > 0 ? durationMs : null) != null,
    note: long ? LONG_TRACK_NOTE : "",
  };
}

export function readYtdlpDump(text: string): {
  id: string;
  title: string;
  uploader: string;
  durationMs: number | null;
} | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const json = JSON.parse(text.slice(start, end + 1)) as {
      id?: unknown;
      title?: unknown;
      uploader?: unknown;
      channel?: unknown;
      duration?: unknown;
    };
    if (typeof json.title !== "string" || !json.title.trim()) return null;
    const durationSec = typeof json.duration === "number" && json.duration > 0 ? json.duration : null;
    const uploader =
      typeof json.uploader === "string" && json.uploader.trim()
        ? json.uploader
        : typeof json.channel === "string"
          ? json.channel
          : "";
    return {
      id: typeof json.id === "string" ? json.id : "",
      title: json.title,
      uploader,
      durationMs: durationSec == null ? null : Math.round(durationSec * 1000),
    };
  } catch {
    return null;
  }
}

export function readFfprobeDuration(text: string): number | null {
  try {
    const json = JSON.parse(text) as { format?: { duration?: unknown } };
    const raw = json.format?.duration;
    const seconds = typeof raw === "string" || typeof raw === "number" ? Number(raw) : Number.NaN;
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return Math.round(seconds * 1000);
  } catch {
    return null;
  }
}

export function readDownloadPercent(line: string): number | null {
  const match = /\[download\]\s+(\d+(?:\.\d+)?)%/.exec(line);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function projectFromImport(input: {
  kind: "youtube" | "file";
  url: string;
  mediaPath: string;
  title: string;
  artist: string;
  durationMs: number;
  mode: "video" | "audio";
  lockTitle: boolean;
  lockArtist: boolean;
}): Project {
  const project = exampleProject();
  project.source = {
    kind: input.kind,
    url: input.url,
    mediaPath: input.mediaPath,
    mode: input.mode,
  };
  project.identity = {
    title: input.title,
    artist: input.artist,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    lockTitle: input.lockTitle,
    lockArtist: input.lockArtist,
  };
  return project;
}
