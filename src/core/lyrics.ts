import { hasKana, isChineseOnly, isJapaneseLine, isKana, looksLikeChinese } from "./text";
import {
  HOLD_MAX_MS,
  HOLD_MIN_MS,
  MAX_MS,
  MIN_MS,
  RATE_MAX,
  RATE_MIN,
  type AddedLyric,
  type TrackTiming,
  defaultTiming,
  replaceAdded,
  withAdded,
  withLineHold,
  withLineShift,
} from "./timing";

export const CONSECUTIVE_MS = 15_000;
export const DEFAULT_LINE_MS = 14_500;
export const HOLD_AFTER_MS = 400;
export const TRANS_PAIR_MS = 4_000;
export const MAX_OVERLAY_WORDS = 80;

export type LyricWord = { startMs: number; durMs: number; text: string };

export type LyricLine = {
  timeMs: number;
  text: string;
  translatedText: string | null;
  words: LyricWord[] | null;
  durationMs: number | null;
  sourceKey: string | null;
};

export type YrcLine = { startMs: number; durMs: number; words: LyricWord[] };

export type ClipLyric = { atMs: number; text: string; trans: string | null; holdMs: number };

export function lyricLine(timeMs: number, text: string, extra: Partial<LyricLine> = {}): LyricLine {
  return {
    timeMs,
    text,
    translatedText: null,
    words: null,
    durationMs: null,
    sourceKey: null,
    ...extra,
  };
}

function newId(): string {
  return globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 8);
}

export function lineKey(line: LyricLine): string {
  if (line.sourceKey) return line.sourceKey;
  return `${Math.round(line.timeMs)}|${line.text}`;
}

export function addedKey(id: string): string {
  return `add|${id}`;
}

export function isAddedKey(key: string): boolean {
  return key.startsWith("add|");
}

export function addedId(key: string): string {
  return isAddedKey(key) ? key.slice(4) : key;
}

export function overlayFrozen(words: LyricWord[] | null | undefined, elapsedMs: number): boolean {
  if (!words || words.length === 0) return true;
  const n = Math.min(words.length, MAX_OVERLAY_WORDS);
  const last = words[n - 1];
  return elapsedMs >= last.startMs + Math.max(0, last.durMs);
}

export function usableTrackDuration(ms: number | null | undefined): number | null {
  if (ms == null || ms < 20_000) return null;
  if (ms >= 12 * 60_000) return null;
  return ms;
}

const lrcRegex = /\[(\d+):(\d+)\.(\d{2,3})\](.*)/;
const yrcLineRegex = /^\[(\d+),(\d+)\]/;
const yrcWordPattern = "\\((\\d+),(\\d+),\\d+\\)";

export function isLrcJunk(text: string): boolean {
  if (text.toLowerCase() === "undefined") return true;
  if (text.toLowerCase().startsWith("by:")) return true;
  if (text.toLowerCase().startsWith("[by:")) return true;
  const compact = text.replaceAll(" ", "");
  return (
    compact.startsWith("作词") ||
    compact.startsWith("作詞") ||
    compact.startsWith("作曲") ||
    compact.startsWith("编曲") ||
    compact.startsWith("編曲") ||
    compact.startsWith("歌词:") ||
    compact.startsWith("歌詞:")
  );
}

export function parseLrc(raw: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const line of raw.split("\n")) {
    const m = lrcRegex.exec(line);
    if (!m) continue;
    const min = Number(m[1]);
    const sec = Number(m[2]);
    const msRaw = m[3];
    const ms = msRaw.length === 2 ? Number(msRaw) * 10 : Number(msRaw);
    const text = m[4].trim();
    if (isLrcJunk(text)) continue;
    lines.push(lyricLine((min * 60 + sec) * 1000 + ms, text));
  }
  lines.sort((a, b) => a.timeMs - b.timeMs);
  return lines;
}

export function isInstrumentalPlaceholder(lines: LyricLine[]): boolean {
  const meaningful = lines.filter((line) => line.text.trim());
  if (meaningful.length === 0) return false;
  return meaningful.every((line) => {
    const s = line.text.replaceAll(" ", "");
    return (
      s.includes("纯音乐") ||
      s.includes("純音樂") ||
      s.includes("请欣赏") ||
      s.includes("請欣賞") ||
      s.includes("没有歌词") ||
      s.includes("沒有歌詞")
    );
  });
}

export function mergeYrcTimings(lyrics: LyricLine[], yrcBody: string): void {
  const yrcLines = parseYrcLines(yrcBody);
  if (yrcLines.length === 0) return;
  let yi = 0;
  for (const line of lyrics) {
    const ms = Math.round(line.timeMs);
    while (yi < yrcLines.length && yrcLines[yi].startMs + 150 < ms) yi++;
    if (yi >= yrcLines.length) break;
    if (Math.abs(yrcLines[yi].startMs - ms) <= 1200) {
      line.words = yrcLines[yi].words;
      if (yrcLines[yi].durMs > 0) line.durationMs = yrcLines[yi].durMs;
      yi++;
    }
  }
}

export function mergeTranslation(orig: LyricLine[], trans: LyricLine[]): void {
  for (const t of trans) {
    if (!t.text.trim()) continue;
    let best: LyricLine | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const line of orig) {
      const delta = Math.abs(line.timeMs - t.timeMs);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = line;
      }
    }
    if (best && bestDelta < 500) best.translatedText = t.text;
  }
}

export function parseYrcLines(yrc: string): YrcLine[] {
  const result: YrcLine[] = [];
  for (const raw of yrc.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (!line) continue;
    const hm = yrcLineRegex.exec(line);
    if (!hm) continue;
    const lineStart = Number(hm[1]);
    const lineDur = Number(hm[2]);
    if (!Number.isFinite(lineStart)) continue;
    const rest = line.slice(hm[0].length);
    const matches = [...rest.matchAll(new RegExp(yrcWordPattern, "g"))];
    if (matches.length === 0) continue;
    const rawWords: { start: number; dur: number; txt: string }[] = [];
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const start = Number(m[1]);
      let dur = Number(m[2]);
      if (!Number.isFinite(start) || !Number.isFinite(dur)) continue;
      const textStart = (m.index ?? 0) + m[0].length;
      if (textStart < 0 || textStart > rest.length) continue;
      let textEnd = i + 1 < matches.length ? (matches[i + 1].index ?? rest.length) : rest.length;
      if (textEnd < textStart) textEnd = textStart;
      if (textEnd > rest.length) textEnd = rest.length;
      const txt = rest.slice(textStart, textEnd);
      if (!txt) continue;
      if (dur < 0) dur = 0;
      rawWords.push({ start, dur, txt });
    }
    if (rawWords.length === 0) continue;
    const first = rawWords[0].start;
    const absolute = first + 80 >= lineStart;
    const words: LyricWord[] = [];
    for (const w of rawWords) {
      let rel = absolute ? w.start - lineStart : w.start;
      if (rel < 0) rel = 0;
      if (rel > 60_000) continue;
      words.push({ startMs: rel, durMs: w.dur, text: w.txt });
    }
    if (words.length > 0) result.push({ startMs: lineStart, durMs: lineDur, words });
  }
  return result;
}

export function splitBilingual(text: string): { orig: string; trans: string | null } {
  if (!text || !text.trim()) return { orig: text, trans: null };
  if (!hasKana(text) || !looksLikeChinese(text)) return { orig: text, trans: null };
  for (const sep of [" / ", "／", " /", "/ ", " | ", "｜", " // "]) {
    const at = text.indexOf(sep);
    if (at <= 0) continue;
    const left = text.slice(0, at).trim();
    const right = text.slice(at + sep.length).trim();
    if (!left || !right) continue;
    if (isJapaneseLine(left) && isChineseOnly(right)) return { orig: left, trans: right };
    if (isChineseOnly(left) && isJapaneseLine(right)) return { orig: right, trans: left };
  }
  let lastKana = -1;
  for (let i = 0; i < text.length; i++) {
    if (isKana(text[i])) lastKana = i;
  }
  if (lastKana < 0 || lastKana >= text.length - 2) return { orig: text, trans: null };
  let split = lastKana + 1;
  while (split < text.length && (/\s/u.test(text[split]) || "·・/／|｜".includes(text[split]))) split++;
  const rest = text.slice(split).trim();
  const head = text.slice(0, split).trim();
  if (rest.length >= 2 && isChineseOnly(rest) && isJapaneseLine(head)) return { orig: head, trans: rest };
  return { orig: text, trans: null };
}

function sliceWords(words: LyricWord[] | null, origChars: number): LyricWord[] | null {
  if (!words || origChars <= 0) return words;
  const jp: LyricWord[] = [];
  let pos = 0;
  for (const w of words) {
    const len = (w.text ?? "").length;
    if (pos >= origChars) break;
    jp.push(w);
    pos += len;
  }
  return jp.length > 0 ? jp : words;
}

export function splitMixedLyrics(lyrics: LyricLine[]): void {
  for (let i = 0; i < lyrics.length - 1; ) {
    const a = lyrics[i];
    const b = lyrics[i + 1];
    if (!a.text.trim() || !b.text.trim()) {
      i++;
      continue;
    }
    if (Math.abs(a.timeMs - b.timeMs) > 150) {
      i++;
      continue;
    }
    if (!a.translatedText && isJapaneseLine(a.text) && isChineseOnly(b.text)) {
      a.translatedText = b.text;
      lyrics.splice(i + 1, 1);
      continue;
    }
    if (!b.translatedText && isChineseOnly(a.text) && isJapaneseLine(b.text)) {
      b.translatedText = a.text;
      lyrics.splice(i, 1);
      continue;
    }
    i++;
  }
  for (let i = 0; i < lyrics.length; i++) {
    const line = lyrics[i];
    let split = splitBilingual(line.text);
    if (split.trans == null && line.words && line.words.length > 0) {
      split = splitBilingual(line.words.map((w) => w.text ?? "").join(""));
    }
    if (split.trans == null) continue;
    lyrics[i] = {
      ...line,
      text: split.orig,
      translatedText: line.translatedText ? line.translatedText : split.trans,
      words: sliceWords(line.words, split.orig.length) ?? line.words,
    };
  }
}

export function isAttachedTranslation(phrase: LyricLine, other: LyricLine): boolean {
  if (!other.text.trim()) return false;
  if (!isJapaneseLine(phrase.text) || !isChineseOnly(other.text)) return false;
  const dt = other.timeMs - phrase.timeMs;
  return dt >= -200 && dt <= TRANS_PAIR_MS;
}

export function isAttachedTranslationLine(lines: LyricLine[], idx: number): boolean {
  if (idx < 0 || idx >= lines.length) return false;
  if (!isChineseOnly(lines[idx].text)) return false;
  for (let i = idx - 1; i >= 0; i--) {
    if (!lines[i].text.trim()) continue;
    return isAttachedTranslation(lines[i], lines[idx]);
  }
  return false;
}

export function nextSungIndex(lines: LyricLine[], afterIdx: number): number {
  const cur = afterIdx >= 0 && afterIdx < lines.length ? lines[afterIdx] : null;
  for (let i = afterIdx + 1; i < lines.length; i++) {
    if (!lines[i].text.trim()) continue;
    if (cur && isAttachedTranslation(cur, lines[i])) continue;
    return i;
  }
  return -1;
}

export function prevSungIndex(lines: LyricLine[], beforeIdx: number): number {
  const cur = beforeIdx >= 0 && beforeIdx < lines.length ? lines[beforeIdx] : null;
  for (let i = beforeIdx - 1; i >= 0; i--) {
    if (!lines[i].text.trim()) continue;
    if (cur && (isAttachedTranslation(lines[i], cur) || isAttachedTranslation(cur, lines[i]))) continue;
    return i;
  }
  return -1;
}

export function resolvedTranslation(lines: LyricLine[], line: LyricLine): string | null {
  if (line.translatedText && line.translatedText.trim()) return line.translatedText;
  if (!isJapaneseLine(line.text)) return null;
  for (const other of lines) {
    if (other === line) continue;
    if (!other.text.trim() || !isChineseOnly(other.text)) continue;
    if (isAttachedTranslation(line, other)) return other.text;
  }
  return null;
}

export function timeOfMs(line: LyricLine, shifts?: Record<string, number> | null): number {
  if (shifts && Object.keys(shifts).length > 0) {
    const ms = shifts[lineKey(line)];
    if (ms) return line.timeMs + ms;
  }
  return line.timeMs;
}

export function lineDisplayEndMs(
  lines: LyricLine[],
  idx: number,
  shifts?: Record<string, number> | null,
  holds?: Record<string, number> | null,
): number {
  const line = lines[idx];
  const start = timeOfMs(line, shifts);
  const nextSung = nextSungIndex(lines, idx);
  const next = nextSung >= 0 ? timeOfMs(lines[nextSung], shifts) : Number.POSITIVE_INFINITY;
  const extra = holds?.[lineKey(line)] ?? 0;
  const linkMs = CONSECUTIVE_MS + Math.max(0, extra);
  let end: number;
  if (Number.isFinite(next) && next - start <= linkMs) {
    end = next;
  } else {
    let hold = start + DEFAULT_LINE_MS;
    if (line.durationMs != null && line.durationMs > 0) {
      const yrcEnd = start + line.durationMs + HOLD_AFTER_MS;
      if (yrcEnd > hold) hold = yrcEnd;
    } else if (line.words && line.words.length > 0) {
      const last = line.words[line.words.length - 1];
      const sung = start + Math.max(0, last.startMs + last.durMs) + HOLD_AFTER_MS;
      if (sung > hold) hold = sung;
    }
    end = next < hold ? next : hold;
  }
  if (extra !== 0) {
    end += extra;
    const minEnd = start + 80;
    if (end < minEnd) end = minEnd;
  }
  return end;
}

export function lineIsActive(
  lines: LyricLine[],
  idx: number,
  posMs: number,
  shifts?: Record<string, number> | null,
  holds?: Record<string, number> | null,
): boolean {
  if (idx < 0 || idx >= lines.length) return false;
  const line = lines[idx];
  if (!line.text.trim()) return false;
  if (posMs < timeOfMs(line, shifts)) return false;
  if (isAttachedTranslationLine(lines, idx)) return false;
  const prev = prevSungIndex(lines, idx);
  if (prev >= 0) {
    const start = timeOfMs(line, shifts);
    const prevEnd = lineDisplayEndMs(lines, prev, shifts, holds);
    if (prevEnd > start && posMs < prevEnd) return false;
  }
  return posMs < lineDisplayEndMs(lines, idx, shifts, holds);
}

export function applyEdits(src: LyricLine[], timing: TrackTiming): LyricLine[] {
  const result: LyricLine[] = [];
  for (const line of src) {
    const key = lineKey(line);
    const hasText = !!timing.texts && Object.prototype.hasOwnProperty.call(timing.texts, key);
    const textOv = hasText ? timing.texts![key] : null;
    const hasTrans = !!timing.trans && Object.prototype.hasOwnProperty.call(timing.trans, key);
    const transOv = hasTrans ? timing.trans![key] : null;
    if (hasText && !(textOv ?? "").trim()) continue;
    if (hasText || hasTrans) {
      result.push({
        timeMs: line.timeMs,
        text: hasText ? textOv! : line.text,
        translatedText: hasTrans ? (transOv && transOv.trim() ? transOv : null) : line.translatedText,
        durationMs: line.durationMs,
        sourceKey: key,
        words: hasText ? null : line.words,
      });
    } else {
      result.push(line);
    }
  }
  if (timing.added && timing.added.length > 0) {
    for (const a of timing.added) {
      if (!a.text.trim()) continue;
      const at = Math.min(MAX_MS, Math.max(0, a.atMs));
      const id = a.id ? a.id : `t${at}`;
      result.push(
        lyricLine(at, a.text, {
          sourceKey: addedKey(id),
          translatedText: a.trans && a.trans.trim() ? a.trans : null,
        }),
      );
    }
  }
  if (result.length > 1) result.sort((a, b) => a.timeMs - b.timeMs);
  return result;
}

export function placementMs(prev: number | null, next: number | null, fallbackMs: number): number {
  if (prev != null && next != null) {
    const gap = next - prev;
    if (gap > 80) return Math.round(prev + gap / 2);
    return Math.round(prev);
  }
  if (next != null) return Math.max(0, Math.round(next) - 500);
  if (prev != null) return Math.round(prev) + 1_000;
  return Math.max(0, fallbackMs);
}

export function setEffectiveTime(t: TrackTiming, line: LyricLine, atMs: number): TrackTiming {
  atMs = Math.min(MAX_MS, Math.max(0, atMs));
  const key = lineKey(line);
  if (isAddedKey(key)) {
    const id = addedId(key);
    const cur = t.added?.find((a) => a.id === id) ?? {
      atMs,
      text: line.text,
      id,
      trans: line.translatedText,
    };
    return withLineShift(replaceAdded(t, id, { ...cur, atMs }), key, 0);
  }
  const baseMs = Math.round(line.timeMs);
  return withLineShift(t, key, atMs - baseMs);
}

export function duplicateLine(t: TrackTiming, line: LyricLine, atMs: number): TrackTiming {
  const id = newId();
  let next = withAdded(t, { atMs, text: line.text, id, trans: line.translatedText });
  const hold = next.holds?.[lineKey(line)] ?? 0;
  if (hold !== 0) next = withLineHold(next, addedKey(id), hold);
  return next;
}

export function formatStamp(timeMs: number): string {
  const rounded = Math.round(timeMs);
  const totalSec = Math.trunc(rounded / 1000);
  const minutes = Math.trunc(totalSec / 60);
  const seconds = totalSec % 60;
  const millis = ((rounded % 1000) + 1000) % 1000;
  const cs = Math.trunc(millis / 10);
  return `[${minutes}:${String(seconds).padStart(2, "0")}.${String(cs).padStart(2, "0")}]`;
}

export function formatShownLrc(lines: LyricLine[], timing: TrackTiming = defaultTiming(), headers = true): string {
  let sb = "";
  if (headers) {
    sb += `[offset:${timing.offsetMs}]\n`;
    sb += `[dl_rate:${timing.rate.toFixed(3)}]\n`;
  }
  for (const line of lines) {
    if (!line.text.trim()) continue;
    const stamp = formatStamp(timeOfMs(line, timing.lines));
    sb += `${stamp}${line.text}\n`;
    if (line.translatedText && line.translatedText.trim()) sb += `${stamp}${line.translatedText}\n`;
    const hold = timing.holds?.[lineKey(line)] ?? 0;
    if (hold !== 0) sb += `[dl_hold:${hold}]\n`;
  }
  return sb;
}

export function parseTimingTags(raw: string): { offsetMs: number | null; rate: number | null } {
  let offsetMs: number | null = null;
  let rate: number | null = null;
  if (!raw || !raw.trim()) return { offsetMs, rate };
  for (const rawLine of raw.replaceAll("\r\n", "\n").split("\n")) {
    const line = rawLine.trim();
    if (line.length < 8 || line[0] !== "[") continue;
    const close = line.indexOf("]");
    if (close < 2) continue;
    const inner = line.slice(1, close);
    const colon = inner.indexOf(":");
    if (colon <= 0) continue;
    const key = inner.slice(0, colon).trim();
    const val = inner.slice(colon + 1).trim();
    if (key.toLowerCase() === "offset" && /^-?\d+$/.test(val)) {
      offsetMs = Math.min(MAX_MS, Math.max(MIN_MS, Number(val)));
    } else if (
      (key.toLowerCase() === "dl_rate" || key.toLowerCase() === "rate") &&
      Number.isFinite(Number(val)) &&
      Number(val) > 0
    ) {
      rate = Math.min(RATE_MAX, Math.max(RATE_MIN, Number(val)));
    }
  }
  return { offsetMs, rate };
}

function attachHolds(raw: string, clips: ClipLyric[]): void {
  if (clips.length === 0) return;
  const used = clips.map(() => false);
  let current = -1;
  let lastTime: number | null = null;
  for (const rawLine of raw.replaceAll("\r\n", "\n").split("\n")) {
    const line = rawLine.trim();
    if (line.toLowerCase().startsWith("[dl_hold:")) {
      const close = line.indexOf("]");
      const val = close > 9 ? line.slice(9, close).trim() : "";
      if (current >= 0 && /^-?\d+$/.test(val)) {
        const ms = Math.min(HOLD_MAX_MS, Math.max(HOLD_MIN_MS, Number(val)));
        clips[current] = { ...clips[current], holdMs: ms };
      }
      continue;
    }
    const m = lrcRegex.exec(line);
    if (!m) continue;
    const text = m[4].trim();
    if (!text.trim() || isLrcJunk(text)) continue;
    const min = Number(m[1]);
    const sec = Number(m[2]);
    const msRaw = m[3];
    const stampMs = msRaw.length === 2 ? Number(msRaw) * 10 : Number(msRaw);
    const time = (min * 60 + sec) * 1000 + stampMs;
    if (lastTime === time) continue;
    lastTime = time;
    current = -1;
    for (let i = 0; i < clips.length; i++) {
      if (used[i] || clips[i].atMs !== time) continue;
      used[i] = true;
      current = i;
      break;
    }
  }
}

export function parseClipboardLyrics(raw: string, fallbackStartMs: number): ClipLyric[] {
  const result: ClipLyric[] = [];
  if (!raw || !raw.trim()) return result;
  const lrc = parseLrc(raw);
  if (lrc.length > 0 && raw.includes("[")) {
    splitMixedLyrics(lrc);
    for (const line of lrc) {
      if (!line.text.trim()) continue;
      result.push({ atMs: timeOfMs(line, null), text: line.text, trans: line.translatedText, holdMs: 0 });
    }
    if (result.length > 0) {
      attachHolds(raw, result);
      return result;
    }
  }
  const parts: string[] = [];
  for (const rawLine of raw.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n")) {
    const text = rawLine.trim();
    if (text) parts.push(text);
  }
  let at = Math.max(0, fallbackStartMs);
  for (let i = 0; i < parts.length; ) {
    const a = parts[i];
    if (i + 1 < parts.length && !isChineseOnly(a) && isChineseOnly(parts[i + 1])) {
      result.push({ atMs: at, text: a, trans: parts[i + 1], holdMs: 0 });
      i += 2;
    } else {
      result.push({ atMs: at, text: a, trans: null, holdMs: 0 });
      i++;
    }
    at += 1_000;
  }
  return result;
}

export function restoreLyrics(t: TrackTiming): TrackTiming {
  return { ...defaultTiming(), offsetMs: t.offsetMs, rate: t.rate };
}

export function clearShown(t: TrackTiming, source: LyricLine[]): TrackTiming {
  let hide: Record<string, string> | null = null;
  for (const line of source) {
    if (!line.text.trim()) continue;
    hide ??= {};
    hide[lineKey(line)] = "";
  }
  return {
    offsetMs: t.offsetMs,
    rate: t.rate,
    lines: null,
    holds: null,
    texts: hide,
    added: null,
    trans: null,
  };
}

export function replaceShown(
  t: TrackTiming,
  source: LyricLine[],
  clips: ClipLyric[],
  offsetMs?: number | null,
  rate?: number | null,
): TrackTiming {
  const cleared = clearShown(t, source);
  const off = offsetMs ?? cleared.offsetMs;
  const r = rate ?? cleared.rate;
  if (clips.length === 0) {
    return { offsetMs: off, rate: r, lines: null, holds: null, texts: cleared.texts, added: null, trans: null };
  }
  const added: AddedLyric[] = [];
  let holds: Record<string, number> | null = null;
  for (const clip of clips) {
    if (!clip.text.trim()) continue;
    const id = newId();
    added.push({ atMs: clip.atMs, text: clip.text, id, trans: clip.trans });
    if (clip.holdMs !== 0) {
      holds ??= {};
      holds[addedKey(id)] = Math.min(HOLD_MAX_MS, Math.max(HOLD_MIN_MS, clip.holdMs));
    }
  }
  return {
    offsetMs: off,
    rate: r,
    lines: null,
    holds,
    texts: cleared.texts,
    added: added.length === 0 ? null : added,
    trans: null,
  };
}
