import { lineIsActive, lineKey, lyricLine, nextSungIndex, type LyricLine, type LyricWord } from "./lyrics";

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
  wordIndex: number;
  text: string;
  trans: string;
  nextText: string;
};

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

export function previewFrame(lines: LyricLine[], posMs: number): PreviewFrame {
  let index = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lineIsActive(lines, i, posMs)) index = i;
  }
  if (index < 0) {
    return { index: -1, key: "", wordIndex: -1, text: "", trans: "", nextText: "" };
  }
  const line = lines[index];
  const next = nextSungIndex(lines, index);
  return {
    index,
    key: lineKey(line),
    wordIndex: activeWordIndex(line.words, posMs - line.timeMs),
    text: line.text,
    trans: line.translatedText ?? "",
    nextText: next >= 0 ? lines[next].text : "",
  };
}
