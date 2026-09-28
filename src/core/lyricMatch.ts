import type { LyricCandidate } from "./candidate";
import { lineKey, splitMixedLyrics, usableTrackDuration, type LyricLine } from "./lyrics";
import type { Project } from "./project";
import type { ScoredCandidate } from "./score";
import { convert } from "./s2t";
import type { LyricHit } from "../shared/pick";

export function lyricHits(ranked: ScoredCandidate[], trackMs: number | null): LyricHit[] {
  const usable = usableTrackDuration(trackMs);
  return ranked.map(({ candidate, score }) => ({
    key: candidate.key,
    source: candidate.source,
    title: candidate.title,
    artist: candidate.artist,
    album: candidate.album,
    durationMs: candidate.durationMs,
    deltaMs: usable != null && candidate.durationMs >= 8_000 ? candidate.durationMs - usable : null,
    score,
  }));
}

export function formatDurationDelta(deltaMs: number | null): string {
  if (deltaMs == null) return "時長未用";
  const seconds = Math.abs(deltaMs) / 1000;
  if (deltaMs === 0) return "時長差 0.0s";
  const sign = deltaMs > 0 ? "+" : "−";
  return `時長差 ${sign}${seconds.toFixed(1)}s`;
}

export function finishLyricLines(lines: LyricLine[]): LyricLine[] {
  const copy = lines.map((line) => ({
    ...line,
    words: line.words?.map((word) => ({ ...word })) ?? null,
  }));
  splitMixedLyrics(copy);
  for (const line of copy) {
    line.text = convert(line.text) ?? line.text;
    if (line.translatedText) line.translatedText = convert(line.translatedText) ?? line.translatedText;
    if (line.words) {
      line.words = line.words.map((word) => ({ ...word, text: convert(word.text) ?? word.text }));
    }
  }
  return copy;
}

export function applyLyricsToProject(
  project: Project,
  lines: LyricLine[],
  chosen: { key: string; source: string; score: number; autoAccepted: boolean; reason: string },
): Project {
  const finished = finishLyricLines(lines);
  const keys = new Set(finished.map((line) => lineKey(line)));
  const dropped = countDropped(project.timing.lines, keys)
    + countDropped(project.timing.holds, keys)
    + countDropped(project.timing.texts, keys)
    + countDropped(project.timing.trans, keys);
  return {
    ...project,
    lyrics: {
      candidateKey: chosen.key,
      source: chosen.source,
      lines: finished.map(projectLine),
    },
    timing: {
      offsetMs: project.timing.offsetMs,
      rate: project.timing.rate,
      lines: keepKnown(project.timing.lines, keys),
      holds: keepKnown(project.timing.holds, keys),
      texts: keepKnown(project.timing.texts, keys),
      trans: keepKnown(project.timing.trans, keys),
      added: project.timing.added,
    },
    decision: {
      autoAccepted: chosen.autoAccepted && dropped === 0,
      score: chosen.score,
      reason: dropped > 0 ? "要人看" : chosen.reason,
    },
  };
}

export function candidateFromHit(hit: LyricHit): LyricCandidate {
  return {
    key: hit.key,
    source: hit.source as LyricCandidate["source"],
    title: hit.title,
    artist: hit.artist,
    album: hit.album,
    durationMs: hit.durationMs,
    hasWords: false,
  };
}

function projectLine(line: LyricLine): Project["lyrics"]["lines"][number] {
  return {
    atMs: Math.max(0, Math.round(line.timeMs)),
    text: line.text,
    trans: line.translatedText ?? "",
    words: (line.words ?? []).map((word) => ({
      startMs: Math.round(word.startMs),
      durMs: Math.max(0, Math.round(word.durMs)),
      text: word.text,
    })),
  };
}

function keepKnown<T>(map: Record<string, T>, keys: Set<string>): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(map)) {
    if (keys.has(key) || key.startsWith("add|")) next[key] = value;
  }
  return next;
}

function countDropped(map: Record<string, unknown>, keys: Set<string>): number {
  let dropped = 0;
  for (const key of Object.keys(map)) {
    if (!keys.has(key) && !key.startsWith("add|")) dropped += 1;
  }
  return dropped;
}
