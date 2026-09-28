import {
  applyEdits,
  isAttachedTranslationLine,
  lineDisplayEndMs,
  timeOfMs,
  type LyricLine,
} from "./lyrics";
import { assColor, assFontSize, defaultLook, lyricFont, type LyricLook } from "./lyricLook";
import { mediaMsForLyric } from "./preview";
import { defaultTiming, type TrackTiming } from "./timing";

export function buildKaraokeAss(
  baseLines: LyricLine[],
  timing: TrackTiming = defaultTiming(),
  look: LyricLook = defaultLook,
): string {
  const lines = applyEdits(baseLines, timing);
  const events: string[] = [];
  let prevEnd = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.text.trim() || isAttachedTranslationLine(lines, i)) continue;
    const lyricStart = timeOfMs(line, timing.lines);
    const lyricEnd = lineDisplayEndMs(lines, i, timing.lines, timing.holds);
    const visibleStart = Math.max(lyricStart, prevEnd);
    prevEnd = Math.max(prevEnd, lyricEnd);
    if (lyricEnd - visibleStart < 40) continue;
    const start = mediaMsForLyric(visibleStart, timing.offsetMs, timing.rate);
    const end = mediaMsForLyric(lyricEnd, timing.offsetMs, timing.rate);
    if (end <= start) continue;
    events.push(dialogue("Orig", start, end, `${place(look, 0)}${karaokeText(line, visibleStart - lyricStart, timing.rate, look)}`));
    const trans = line.translatedText?.trim();
    if (trans) events.push(dialogue("Trans", start, end, `${place(look, look.size * 1.25)}${escapeAss(trans)}`));
  }
  return `${scriptHeader(look)}\n${events.join("\n")}\n`;
}

export function karaokeCentiseconds(line: LyricLine, rate = 1): number[] {
  if (!line.words || line.words.length === 0) return [];
  const safe = !Number.isFinite(rate) || rate <= 0 ? 1 : rate;
  const durations = line.words.map((word) => Math.max(0, word.durMs / safe));
  const total = Math.round(durations.reduce((sum, dur) => sum + dur, 0) / 10);
  const parts: number[] = [];
  let used = 0;
  for (let i = 0; i < durations.length; i++) {
    if (i === durations.length - 1) {
      parts.push(Math.max(0, total - used));
    } else {
      const cs = Math.round(durations[i] / 10);
      parts.push(cs);
      used += cs;
    }
  }
  return parts;
}

function karaokeText(line: LyricLine, clipMs: number, rate: number, look: LyricLook): string {
  if (!line.words || line.words.length === 0) return escapeAss(line.text);
  let skip = Math.max(0, clipMs);
  const kept: { durMs: number; text: string }[] = [];
  for (const word of line.words) {
    let dur = word.durMs;
    if (skip >= dur) {
      skip -= dur;
      continue;
    }
    if (skip > 0) {
      dur -= skip;
      skip = 0;
    }
    kept.push({ durMs: dur, text: word.text });
  }
  if (kept.length === 0) return escapeAss(line.text);
  const fake = { ...line, words: kept.map((word) => ({ startMs: 0, durMs: word.durMs, text: word.text })) };
  const parts = karaokeCentiseconds(fake, rate);
  const body = parts.map((cs, index) => `{\\k${cs}}${escapeAss(kept[index]?.text ?? "")}`).join("");
  return `{\\1c${assColor(look.sungColor)}\\2c${assColor(look.color)}}${body}`;
}

function dialogue(style: string, startMs: number, endMs: number, text: string): string {
  return `Dialogue: 0,${assTime(startMs)},${assTime(endMs)},${style},,0,0,0,,${text}`;
}

export function assTime(ms: number): string {
  const clamped = Math.max(0, Math.round(ms / 10));
  const centi = clamped % 100;
  const totalSec = Math.floor(clamped / 100);
  const seconds = totalSec % 60;
  const minutes = Math.floor(totalSec / 60) % 60;
  const hours = Math.floor(totalSec / 3600);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centi).padStart(2, "0")}`;
}

function escapeAss(text: string): string {
  return text.replaceAll("\\", "\\\\").replaceAll("{", "\\{").replaceAll("}", "\\}").replaceAll("\n", "\\N");
}

function place(look: LyricLook, drop: number): string {
  const x = Math.round(look.x * 1920);
  const y = Math.round(look.y * 1080 + drop);
  const nominal = drop > 0 ? look.size * look.transScale : look.size;
  const size = assFontSize(nominal, look.font);
  return `{\\an5\\pos(${x},${y})\\fs${size}\\bord${look.outline}\\3c${assColor(look.outlineColor)}\\1c${assColor(look.color)}}`;
}

function scriptHeader(look: LyricLook): string {
  const font = lyricFont(look.font).ass;
  const fill = assColor(look.color);
  const sung = assColor(look.sungColor);
  const edge = assColor(look.outlineColor);
  const transSize = assFontSize(look.size * look.transScale, look.font);
  const mainSize = assFontSize(look.size, look.font);
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Orig,${font},${mainSize},${fill},${sung},${edge},&H00000000,0,0,0,0,100,100,0,0,1,${look.outline},0,5,40,40,40,1
Style: Trans,${font},${transSize},${fill},${fill},${edge},&H00000000,0,0,0,0,100,100,0,0,1,${look.outline},0,5,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;
}
