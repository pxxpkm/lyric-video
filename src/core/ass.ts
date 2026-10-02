import {
  applyEdits,
  isAttachedTranslationLine,
  lineDisplayEndMs,
  lineKey,
  timeOfMs,
  type LyricLine,
} from "./lyrics";
import { assColor, assFontSize, defaultLook, edgeOutlineAt, glyphStep, isVerticalFlow, letterGap, lyricFont, type LyricLook } from "./lyricLook";
import {
  assFadeTag,
  assMotion,
  assPoseTags,
  assTransMotion,
  DECOR_MARK,
  decorDots,
  decorFadeTag,
  decorLayout,
  decorMoveWindow,
  isDecor,
  tintMs,
  transOffset,
  type MotionClip,
} from "./motion";
import { mediaMsForLyric } from "./preview";
import { defaultTiming, type TrackTiming } from "./timing";

export function buildKaraokeAss(
  baseLines: LyricLine[],
  timing: TrackTiming = defaultTiming(),
  look: LyricLook = defaultLook,
  clips: MotionClip[] = [],
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
    const clip = clips.find((item) => item.lineKey === lineKey(line));
    const pieces = karaokePieces(line, visibleStart - lyricStart, timing.rate);
    if (isVerticalFlow(look.flow)) {
      events.push(...verticalEvents(line, start, end, look, clip, pieces));
    } else {
      const wordTimed = pieces.some((piece) => piece.cs != null);
      const tint = clip?.preset === "tint" && !wordTimed ? tintOverride(look.color, look.sungColor, end - start) : "";
      const lead = clip ? assMotion(clip, look, start, end, tint) : place(look);
      events.push(dialogue("Orig", start, end, `${lead}${karaokeBody(pieces, look, clip?.preset === "edge")}`));
      pushDecor(events, anchorPx(look, clip), look.color, look, clip, start, end, "Orig", line.text, look.size);
      const trans = line.translatedText?.trim();
      if (trans) {
        const at = transAnchorPx(look, clip);
        const body = clip
          ? assTransMotion(clip, look, start, end, clip.preset === "tint" ? tintOverride(look.transColor, look.sungColor, end - start) : "")
          : posTag(at.x, at.y, "");
        const transText = clip?.preset === "edge" ? edgeBody(trans, look.outlineColor, look.sungColor) : escapeAss(trans);
        events.push(dialogue("Trans", start, end, `${body}${transText}`));
        pushDecor(events, at, look.transColor, look, clip, start, end, "Trans", trans, look.transSize);
      }
    }
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

type KaraokePiece = { cs: number | null; text: string };

function karaokePieces(line: LyricLine, clipMs: number, rate: number): KaraokePiece[] {
  if (!line.words || line.words.length === 0) return [{ cs: null, text: line.text }];
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
  if (kept.length === 0) return [{ cs: null, text: line.text }];
  const fake = { ...line, words: kept.map((word) => ({ startMs: 0, durMs: word.durMs, text: word.text })) };
  const parts = karaokeCentiseconds(fake, rate);
  return parts.map((cs, index) => ({ cs, text: kept[index]?.text ?? "" }));
}

function karaokeBody(pieces: KaraokePiece[], look: LyricLook, edged = false): string {
  if (!edged) {
    if (pieces.every((piece) => piece.cs == null)) return escapeAss(pieces.map((piece) => piece.text).join(""));
    const body = pieces.map((piece) => `{\\k${piece.cs ?? 0}}${escapeAss(piece.text)}`).join("");
    return `{\\1c${assColor(look.sungColor)}\\2c${assColor(look.color)}}${body}`;
  }
  const count = Math.max(1, pieces.reduce((sum, piece) => sum + Array.from(piece.text).length, 0));
  let index = 0;
  const painted = pieces
    .map((piece) =>
      Array.from(piece.text)
        .map((ch, offset) => {
          const outline = `\\3c${assColor(edgeOutlineAt(look.outlineColor, look.sungColor, index, count))}`;
          index += 1;
          const timing = offset === 0 && piece.cs != null ? `\\k${piece.cs}` : "";
          return `{${timing}${outline}}${escapeAss(ch)}`;
        })
        .join(""),
    )
    .join("");
  if (pieces.every((piece) => piece.cs == null)) return painted;
  return `{\\1c${assColor(look.sungColor)}\\2c${assColor(look.color)}}${painted}`;
}

function edgeBody(text: string, from: string, to: string): string {
  const chars = Array.from(text);
  return chars
    .map((ch, index) => `{\\3c${assColor(edgeOutlineAt(from, to, index, chars.length))}}${escapeAss(ch)}`)
    .join("");
}

function verticalEvents(
  line: LyricLine,
  start: number,
  end: number,
  look: LyricLook,
  clip: MotionClip | undefined,
  pieces: KaraokePiece[],
): string[] {
  const anchor = anchorPx(look, clip);
  const transAt = transAnchorPx(look, clip);
  const fade = clip ? assFadeTag(clip, start, end) : "";
  const span = end - start;
  const glyphs = stackGlyphs(pieces);
  const edged = clip?.preset === "edge";
  // 直排每隻字一個對話，樣式 Spacing 唔會拉開字柱，所以步進自己加字距。
  const origStep = glyphStep(look.size, look.tracking);
  const events = glyphs.map((glyph, index) =>
    dialogue(
      "Orig",
      start,
      end,
      `${glyphOverride(anchor.x, columnY(anchor.y, glyphs.length, origStep, index), look.size, look, fade, glyph.switchMs, look.color, clip, span, edged ? edgeOutlineAt(look.outlineColor, look.sungColor, index, glyphs.length) : look.outlineColor)}${escapeAss(glyph.ch)}`,
    ),
  );
  const trans = line.translatedText?.trim();
  if (trans) {
    const chars = Array.from(trans);
    const step = glyphStep(look.transSize, look.tracking);
    chars.forEach((ch, index) => {
      events.push(
        dialogue(
          "Trans",
          start,
          end,
          `${glyphOverride(transAt.x, columnY(transAt.y, chars.length, step, index), look.transSize, look, fade, null, look.transColor, clip, span, edged ? edgeOutlineAt(look.outlineColor, look.sungColor, index, chars.length) : look.outlineColor)}${escapeAss(ch)}`,
        ),
      );
    });
    pushDecor(events, transAt, look.transColor, look, clip, start, end, "Trans", trans, look.transSize);
  }
  pushDecor(events, anchor, look.color, look, clip, start, end, "Orig", line.text, look.size);
  return events;
}

function stackGlyphs(pieces: KaraokePiece[]): { ch: string; switchMs: number | null }[] {
  if (pieces.every((piece) => piece.cs == null)) {
    return Array.from(pieces.map((piece) => piece.text).join("")).map((ch) => ({ ch, switchMs: null }));
  }
  let elapsed = 0;
  const glyphs: { ch: string; switchMs: number | null }[] = [];
  for (const piece of pieces) {
    elapsed += piece.cs ?? 0;
    const switchMs = piece.cs == null ? null : elapsed * 10;
    for (const ch of Array.from(piece.text)) glyphs.push({ ch, switchMs });
  }
  return glyphs;
}

function anchorPx(look: LyricLook, clip: MotionClip | undefined): { x: number; y: number } {
  return {
    x: (clip ? look.x + clip.enter.x : look.x) * 1920,
    y: (clip ? look.y + clip.enter.y : look.y) * 1080,
  };
}

function transAnchorPx(look: LyricLook, clip: MotionClip | undefined): { x: number; y: number } {
  const offset = clip ? transOffset(clip) : { x: 0, y: 0 };
  return { x: (look.transX + offset.x) * 1920, y: (look.transY + offset.y) * 1080 };
}

function posTag(x: number, y: number, fade: string): string {
  return `{\\an5\\pos(${Math.round(x)},${Math.round(y)})${fade}}`;
}

function columnY(center: number, count: number, step: number, index: number): number {
  return center + (index - (count - 1) / 2) * step;
}

function glyphOverride(
  x: number,
  y: number,
  nominal: number,
  look: LyricLook,
  fade: string,
  switchMs: number | null,
  fill: string,
  clip: MotionClip | undefined,
  spanMs: number,
  outline: string,
): string {
  const pose = assPoseTags(clip?.preset, Math.round(x), Math.round(y), spanMs);
  const sung = switchMs == null ? "" : `\\t(${Math.round(switchMs)},${Math.round(switchMs)},\\1c${assColor(look.sungColor)})`;
  const color = clip?.preset === "tint" && switchMs == null ? tintOverride(fill, look.sungColor, spanMs) : `\\1c${assColor(fill)}`;
  const size = assFontSize(nominal, look.font);
  return `{\\an5${pose}\\fs${size}\\bord${look.outline}\\3c${assColor(outline)}${color}${fade}${sung}}`;
}

function pushDecor(
  events: string[],
  anchor: { x: number; y: number },
  fill: string,
  look: LyricLook,
  clip: MotionClip | undefined,
  start: number,
  end: number,
  style: string,
  text: string,
  nominal: number,
): void {
  if (!clip || !isDecor(clip.preset)) return;
  const ox = Math.round(anchor.x);
  const oy = Math.round(anchor.y);
  const span = end - start;
  const layout = decorLayout(text, nominal, isVerticalFlow(look.flow));
  for (const dot of decorDots(clip.preset, span, layout)) {
    const size = assFontSize(dot.size, look.font);
    const move = decorMoveWindow(dot, span);
    const tag = `{\\an5\\move(${ox + dot.x},${oy + dot.y},${ox + dot.x2},${oy + dot.y2},${move.t1},${move.t2})\\fs${size}\\bord0\\1c${assColor(fill)}${decorFadeTag(dot, span)}}`;
    events.push(dialogue(style, start, end, `${tag}${DECOR_MARK}`));
  }
}

function tintOverride(from: string, to: string, spanMs: number): string {
  return `\\1c${assColor(from)}\\t(0,${tintMs(spanMs)},\\1c${assColor(to)})`;
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

function place(look: LyricLook): string {
  const x = Math.round(look.x * 1920);
  const y = Math.round(look.y * 1080);
  const size = assFontSize(look.size, look.font);
  return `{\\an5\\pos(${x},${y})\\fs${size}\\bord${look.outline}\\3c${assColor(look.outlineColor)}\\1c${assColor(look.color)}}`;
}

function scriptHeader(look: LyricLook): string {
  const font = lyricFont(look.font).ass;
  const fill = assColor(look.color);
  const sung = assColor(look.sungColor);
  const edge = assColor(look.outlineColor);
  const transFill = assColor(look.transColor);
  const transSize = assFontSize(look.transSize, look.font);
  const mainSize = assFontSize(look.size, look.font);
  const spacing = Math.round(letterGap(look.tracking));
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Orig,${font},${mainSize},${fill},${sung},${edge},&H00000000,0,0,0,0,100,100,${spacing},0,1,${look.outline},0,5,40,40,40,1
Style: Trans,${font},${transSize},${transFill},${transFill},${edge},&H00000000,0,0,0,0,100,100,${spacing},0,1,${look.outline},0,5,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;
}
