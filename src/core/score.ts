import type { LyricCandidate, LyricSource } from "./candidate";
import { norm } from "./title";
import { usableTrackDuration } from "./lyrics";

export const TITLE_WEIGHT = 0.55;
export const ARTIST_WEIGHT = 0.25;
export const DURATION_WEIGHT = 0.2;
export const WORD_BONUS = 0.05;
export const TITLE_MIN = 0.75;
export const SCORE_MIN = 0.82;
export const MARGIN_MIN = 0.08;
export const DURATION_DELTA_MAX_MS = 8_000;
export const LONG_TRACK_MS = 12 * 60_000;

const SOURCE_BONUS: Record<LyricSource, number> = {
  網易雲: 0.04,
  QQ: 0.03,
  酷狗: 0.02,
  LRCLIB: 0.01,
};

export type ScoredCandidate = {
  candidate: LyricCandidate;
  score: number;
  title: number;
  artist: number;
  duration: number;
};

export type Decision = {
  accept: boolean;
  candidate: LyricCandidate | null;
  reason: string;
  ranked: ScoredCandidate[];
};

function coreTitle(raw: string): string {
  let s = norm(raw);
  s = s.replace(/\s*[([（【].*?[)\]）】]\s*/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/\s*-\s*/g, "-");
  return s;
}

function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bag = (s: string) => {
    const counts = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const gram = s.slice(i, i + 2);
      counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
    return counts;
  };
  const left = bag(a);
  const right = bag(b);
  let shared = 0;
  for (const [gram, count] of left) shared += Math.min(count, right.get(gram) ?? 0);
  return (2 * shared) / (a.length - 1 + (b.length - 1));
}

export function similarity(a: string, b: string): number {
  const left = coreTitle(a);
  const right = coreTitle(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  return dice(left, right);
}

function durationPart(trackMs: number | null, songMs: number): number {
  const usable = usableTrackDuration(trackMs);
  if (usable == null || songMs < 8_000) return 0.5;
  const deltaSec = Math.abs(songMs - usable) / 1000;
  return 1 - Math.min(deltaSec, 30) / 30;
}

export function scoreCandidate(
  query: { title: string; artist: string; durationMs: number | null },
  item: LyricCandidate,
): ScoredCandidate {
  const title = similarity(query.title, item.title);
  const artist = query.artist.trim() ? similarity(query.artist, item.artist) : 0.5;
  const duration = durationPart(query.durationMs, item.durationMs);
  const score =
    TITLE_WEIGHT * title +
    ARTIST_WEIGHT * artist +
    DURATION_WEIGHT * duration +
    (item.hasWords ? WORD_BONUS : 0) +
    SOURCE_BONUS[item.source];
  return { candidate: item, score, title, artist, duration };
}

export function decide(input: {
  title: string;
  artist: string;
  durationMs: number | null;
  candidates: LyricCandidate[];
  rememberedKey?: string | null;
}): Decision {
  const ranked = input.candidates
    .map((item) => scoreCandidate(input, item))
    .sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title));

  const remembered = input.rememberedKey
    ? input.candidates.find((item) => item.key === input.rememberedKey)
    : undefined;
  if (remembered) {
    return { accept: true, candidate: remembered, reason: "已記住", ranked };
  }

  if (input.durationMs != null && input.durationMs >= LONG_TRACK_MS) {
    return { accept: false, candidate: null, reason: "長片", ranked };
  }

  const top = ranked[0];
  if (!top) return { accept: false, candidate: null, reason: "沒有結果", ranked };
  if (top.title < TITLE_MIN) return { accept: false, candidate: null, reason: "歌名不像", ranked };

  const usable = usableTrackDuration(input.durationMs);
  if (usable != null && top.candidate.durationMs >= 8_000) {
    if (Math.abs(top.candidate.durationMs - usable) > DURATION_DELTA_MAX_MS) {
      return { accept: false, candidate: null, reason: "時長差太遠", ranked };
    }
  }

  if (top.score < SCORE_MIN) return { accept: false, candidate: null, reason: "分數不足", ranked };
  const second = ranked[1];
  if (second && top.score - second.score < MARGIN_MIN) {
    return { accept: false, candidate: null, reason: "太接近", ranked };
  }
  return { accept: true, candidate: top.candidate, reason: "自動採用", ranked };
}
