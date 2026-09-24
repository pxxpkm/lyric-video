import { lineIsActive, lineKey, lyricLine, nextSungIndex, timeOfMs, type LyricLine, type LyricWord } from "./lyrics";
import { defaultTiming, type TrackTiming } from "./timing";

export const TEST_CLIP_MS = 10_000;

export function testClipLines(): LyricLine[] {
  return [
    lyricLine(1_000, "第一句"),
    lyricLine(3_000, "第二句", { translatedText: "第二句譯文" }),
    lyricLine(6_000, "第三句", {
      words: [
        { startMs: 0, durMs: 400, text: "第" },
        { startMs: 400, durMs: 400, text: "三" },
        { startMs: 800, durMs: 400, text: "句" },
      ],
    }),
  ];
}

export type PreviewFrame = {
  index: number;
  key: string;
  atMs: number;
  wordIndex: number;
  text: string;
  trans: string;
  nextText: string;
};

export function lyricClockMs(mediaMs: number, offsetMs: number, rate: number): number {
  const safe = !Number.isFinite(rate) || rate <= 0 ? 1 : rate;
  return Math.max(0, (mediaMs - offsetMs) * safe);
}

/** 這句在播放時間上出現的位置。正的延遲會把下列時間往後推。 */
export function mediaMsForLyric(lyricMs: number, offsetMs: number, rate: number): number {
  const safe = !Number.isFinite(rate) || rate <= 0 ? 1 : rate;
  return lyricMs / safe + offsetMs;
}

export function activeWordIndex(words: LyricWord[] | null, elapsedMs: number): number {
  if (!words || words.length === 0) return -1;
  let index = -1;
  const limit = Math.min(words.length, 80);
  for (let i = 0; i < limit; i++) {
    if (words[i].startMs <= elapsedMs) index = i;
    else break;
  }
  return index;
}

export function previewFrame(lines: LyricLine[], posMs: number, timing: TrackTiming = defaultTiming()): PreviewFrame {
  let index = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lineIsActive(lines, i, posMs, timing.lines, timing.holds)) index = i;
  }
  if (index < 0) {
    return { index: -1, key: "", atMs: 0, wordIndex: -1, text: "", trans: "", nextText: "" };
  }
  const line = lines[index];
  const next = nextSungIndex(lines, index);
  const atMs = timeOfMs(line, timing.lines);
  return {
    index,
    key: lineKey(line),
    atMs,
    wordIndex: activeWordIndex(line.words, posMs - atMs),
    text: line.text,
    trans: line.translatedText ?? "",
    nextText: next >= 0 ? lines[next].text : "",
  };
}

export function undoTiming(past: TrackTiming[], current: TrackTiming): { past: TrackTiming[]; current: TrackTiming } {
  if (past.length === 0) return { past, current };
  return { past: past.slice(0, -1), current: past[past.length - 1] };
}
