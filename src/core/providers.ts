import type { LyricCandidate } from "./candidate";
import {
  isInstrumentalPlaceholder,
  mergeTranslation,
  mergeYrcTimings,
  parseLrc,
  type LyricLine,
} from "./lyrics";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function int(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;
}

function names(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => text(asRecord(item)?.name))
    .filter((name) => name.length > 0)
    .join(", ");
}

function decodeBase64(value: string): string {
  const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function parseNeteaseSearch(body: unknown): LyricCandidate[] {
  const songs = asRecord(asRecord(body)?.result)?.songs;
  if (!Array.isArray(songs)) return [];
  const list: LyricCandidate[] = [];
  for (const song of songs) {
    const row = asRecord(song);
    if (!row) continue;
    const id = int(row.id);
    if (id == null) continue;
    const duration = int(row.dt) ?? int(row.duration) ?? 0;
    list.push({
      key: `ncm:${id}`,
      source: "網易雲",
      title: text(row.name),
      artist: names(row.ar ?? row.artists),
      album: text(asRecord(row.al ?? row.album)?.name),
      durationMs: duration > 0 ? duration : 0,
      hasWords: false,
    });
  }
  return list;
}

export function parseQqSearch(body: unknown): LyricCandidate[] {
  const listEl = asRecord(asRecord(asRecord(asRecord(asRecord(body)?.req)?.data)?.body)?.song)?.list;
  if (!Array.isArray(listEl)) return [];
  const list: LyricCandidate[] = [];
  for (const song of listEl) {
    const row = asRecord(song);
    const mid = text(row?.mid);
    if (!row || !mid) continue;
    const seconds = int(row.interval);
    list.push({
      key: `qq:${mid}`,
      source: "QQ",
      title: text(row.name),
      artist: names(row.singer),
      album: text(asRecord(row.album)?.name),
      durationMs: seconds != null && seconds > 0 ? seconds * 1000 : 0,
      hasWords: false,
    });
  }
  return list;
}

export function parseKugouSearch(body: unknown): LyricCandidate[] {
  const info = asRecord(asRecord(body)?.data)?.info;
  if (!Array.isArray(info)) return [];
  const list: LyricCandidate[] = [];
  for (const song of info) {
    const row = asRecord(song);
    const hash = text(row?.hash);
    if (!row || !hash) continue;
    const seconds = int(row.duration);
    list.push({
      key: `kg:${hash}`,
      source: "酷狗",
      title: text(row.songname),
      artist: text(row.singername),
      album: text(row.album_name),
      durationMs: seconds != null && seconds > 0 ? seconds * 1000 : 0,
      hasWords: false,
    });
  }
  return list;
}

export function parseLrcLibSearch(body: unknown): LyricCandidate[] {
  if (!Array.isArray(body)) return [];
  const list: LyricCandidate[] = [];
  for (const item of body) {
    const row = asRecord(item);
    if (!row || row.id == null) continue;
    if (typeof row.syncedLyrics !== "string" || row.syncedLyrics.length === 0) continue;
    const seconds = typeof row.duration === "number" ? row.duration : 0;
    list.push({
      key: `lrc:${String(row.id)}`,
      source: "LRCLIB",
      title: text(row.trackName),
      artist: text(row.artistName),
      album: text(row.albumName),
      durationMs: seconds > 0 ? Math.round(seconds * 1000) : 0,
      hasWords: false,
    });
  }
  return list;
}

function lyricField(body: unknown, name: string): string {
  const field = asRecord(asRecord(body)?.[name]);
  return text(field?.lyric);
}

export function parseNeteaseLyric(body: unknown): LyricLine[] | null {
  const lrc = lyricField(body, "lrc");
  if (!lrc) return null;
  const lines = parseLrc(lrc);
  if (lines.length === 0 || isInstrumentalPlaceholder(lines)) return null;
  const yrc = lyricField(body, "yrc");
  if (yrc) mergeYrcTimings(lines, yrc);
  for (const name of ["tlyric", "ytlrc"]) {
    const trans = lyricField(body, name);
    if (trans) mergeTranslation(lines, parseLrc(trans));
  }
  return lines;
}

export function parseQqLyric(body: unknown): LyricLine[] | null {
  const data = asRecord(asRecord(asRecord(body)?.req)?.data);
  const lyric = text(data?.lyric);
  if (!lyric) return null;
  const lines = parseLrc(decodeBase64(lyric));
  if (lines.length === 0) return null;
  const trans = text(data?.trans);
  if (trans) mergeTranslation(lines, parseLrc(decodeBase64(trans)));
  return lines;
}

export function parseKugouLyric(body: unknown): LyricLine[] | null {
  const content = text(asRecord(body)?.content);
  if (!content) return null;
  const lines = parseLrc(decodeBase64(content));
  return lines.length > 0 ? lines : null;
}

export function parseLrcLibLyric(body: unknown): LyricLine[] | null {
  const lrc = text(asRecord(body)?.syncedLyrics);
  if (!lrc) return null;
  const lines = parseLrc(lrc);
  return lines.length > 0 ? lines : null;
}

export function linesHaveWords(lines: LyricLine[] | null): boolean {
  return !!lines?.some((line) => line.words && line.words.length > 0);
}
