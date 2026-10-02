import { lyricClockMs, previewFrame, type PreviewFrame } from "../../core/preview";
import { applyEdits, lyricLine, type LyricLine } from "../../core/lyrics";
import { canvasFont, defaultLook, isVerticalFlow, type LyricLook } from "../../core/lyricLook";
import { lyricBands, mediaSpans, pointOnBands, sampleClip, sampleTrans, verticalColumns, type MotionClip } from "../../core/motion";
import { defaultTiming, type TrackTiming } from "../../core/timing";
import type { PreviewLine } from "../../shared/preview";

export function sessionLines(lines: PreviewLine[]): LyricLine[] {
  return lines.map((line) =>
    lyricLine(line.atMs, line.text, {
      translatedText: line.trans || null,
      words: line.words.length > 0 ? line.words : null,
    }),
  );
}

export function hitsCurrentLyric(
  canvas: HTMLCanvasElement,
  lines: LyricLine[],
  mediaMs: number,
  timing: TrackTiming,
  look: LyricLook,
  clips: MotionClip[],
  point: { x: number; y: number },
): "orig" | "trans" | null {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx || width < 2 || height < 2) return null;
  const lyricMs = lyricClockMs(mediaMs, timing.offsetMs, timing.rate);
  const shown = applyEdits(lines, timing);
  const frame = previewFrame(shown, lyricMs, timing);
  ctx.save();
  const bands = measureBands(ctx, shown, frame, mediaMs, timing, look, clips, width, height);
  ctx.restore();
  if (!bands) return null;
  if (pointOnBands(point, [bands.main])) return "orig";
  if (pointOnBands(point, [bands.trans])) return "trans";
  return null;
}

export function drawPreview(
  canvas: HTMLCanvasElement,
  lines: LyricLine[],
  mediaMs: number,
  mode: "video" | "audio",
  timing: TrackTiming = defaultTiming(),
  look: LyricLook = defaultLook,
  clips: MotionClip[] = [],
): PreviewFrame {
  const lyricMs = lyricClockMs(mediaMs, timing.offsetMs, timing.rate);
  const shown = applyEdits(lines, timing);
  const frame = previewFrame(shown, lyricMs, timing);
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width < 2 || height < 2) return frame;
  if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return frame;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (mode === "audio") {
    ctx.fillStyle = "#243044";
    ctx.fillRect(0, 0, width, height);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const scale = height / 1080;
  const fontPx = look.size * scale;
  const transPx = look.transSize * scale;
  const edge = Math.max(look.outline * scale, look.outline > 0 ? 1 : 0);
  const placed = linePlacement(clips, frame.key, mediaMs, look, shown, timing);
  const translated = transPlacement(clips, frame.key, look);
  const x = placed.x * width;
  const y = placed.y * height;
  const transX = translated.x * width;
  const transY = translated.y * height;
  ctx.save();
  ctx.globalAlpha = placed.opacity;
  if (!frame.text) {
    ctx.font = canvasFont(look, Math.max(16, fontPx * 0.7));
    paint(ctx, "尚未有歌詞", x, y, look.color, look.outlineColor, edge);
  } else if (isVerticalFlow(look.flow)) {
    const glyphs = mainGlyphs(shown[frame.index]?.words ?? null, frame, look);
    const bands = verticalColumns(x, y, transX, transY, fontPx, transRatio(look), {
      main: glyphs.length,
      trans: Array.from(frame.trans).length,
    });
    drawColumn(ctx, glyphs, bands.main, look, fontPx, edge);
    if (frame.trans && bands.trans) {
      drawColumn(
        ctx,
        Array.from(frame.trans).map((ch) => ({ ch, fill: look.transColor })),
        bands.trans,
        look,
        transPx,
        edge,
      );
    }
  } else {
    const line = shown[frame.index];
    const bands = measureBands(ctx, shown, frame, mediaMs, timing, look, clips, width, height);
    drawCurrent(ctx, line?.words ?? null, frame, x, y, look, fontPx, edge);
    if (frame.trans && bands?.trans) {
      ctx.font = canvasFont(look, transPx);
      paint(ctx, frame.trans, bands.trans.x, bands.trans.y, look.transColor, look.outlineColor, edge);
    }
  }
  ctx.restore();
  return frame;
}

function linePlacement(
  clips: MotionClip[],
  key: string,
  mediaMs: number,
  look: LyricLook,
  shown: LyricLine[],
  timing: TrackTiming,
): { x: number; y: number; opacity: number } {
  const bound = clips.find((clip) => clip.lineKey && clip.lineKey === key);
  const span = bound ? mediaSpans(shown, timing).get(key) : undefined;
  if (!bound) return { x: look.x, y: look.y, opacity: 1 };
  return sampleClip(bound, mediaMs, look, span?.startMs ?? bound.startMs, span?.endMs ?? bound.endMs);
}

function transPlacement(clips: MotionClip[], key: string, look: LyricLook): { x: number; y: number } {
  const bound = clips.find((clip) => clip.lineKey && clip.lineKey === key);
  if (!bound) return { x: look.transX, y: look.transY };
  return sampleTrans(bound, look);
}

function measureBands(
  ctx: CanvasRenderingContext2D,
  shown: LyricLine[],
  frame: PreviewFrame,
  mediaMs: number,
  timing: TrackTiming,
  look: LyricLook,
  clips: MotionClip[],
  width: number,
  height: number,
) {
  if (!frame.text || width < 2 || height < 2) return null;
  const scale = height / 1080;
  const fontPx = look.size * scale;
  const transPx = look.transSize * scale;
  const placed = linePlacement(clips, frame.key, mediaMs, look, shown, timing);
  const translated = transPlacement(clips, frame.key, look);
  if (isVerticalFlow(look.flow)) {
    return verticalColumns(placed.x * width, placed.y * height, translated.x * width, translated.y * height, fontPx, transRatio(look), {
      main: mainGlyphs(shown[frame.index]?.words ?? null, frame, look).length,
      trans: Array.from(frame.trans).length,
    });
  }
  const line = shown[frame.index];
  ctx.font = canvasFont(look, fontPx);
  const main = textWidth(ctx, line?.words ?? null, frame);
  let trans = 0;
  if (frame.trans) {
    ctx.font = canvasFont(look, transPx);
    trans = ctx.measureText(frame.trans).width;
  }
  return lyricBands(placed.x * width, placed.y * height, translated.x * width, translated.y * height, fontPx, transRatio(look), { main, trans });
}

function transRatio(look: LyricLook): number {
  return look.transSize / look.size;
}

function mainGlyphs(
  words: { text: string }[] | null,
  frame: PreviewFrame,
  look: LyricLook,
): { ch: string; fill: string }[] {
  if (!words || words.length === 0 || frame.wordIndex < 0) {
    return Array.from(frame.text).map((ch) => ({ ch, fill: look.color }));
  }
  return words.flatMap((word, index) =>
    Array.from(word.text).map((ch) => ({
      ch,
      fill: index <= frame.wordIndex ? look.sungColor : withAlpha(look.color, 0.45),
    })),
  );
}

function drawColumn(
  ctx: CanvasRenderingContext2D,
  glyphs: { ch: string; fill: string }[],
  band: { x: number; y: number; h: number },
  look: LyricLook,
  fontPx: number,
  edge: number,
  outline = look.outlineColor,
): void {
  if (glyphs.length === 0) return;
  const step = band.h / glyphs.length;
  const top = band.y - band.h / 2 + step / 2;
  ctx.font = canvasFont(look, fontPx);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  glyphs.forEach((glyph, index) => {
    paint(ctx, glyph.ch, band.x, top + index * step, glyph.fill, outline, edge);
  });
}

function textWidth(ctx: CanvasRenderingContext2D, words: { text: string }[] | null, frame: PreviewFrame): number {
  if (!words || words.length === 0 || frame.wordIndex < 0) return ctx.measureText(frame.text).width;
  return words.reduce((sum, word) => sum + ctx.measureText(word.text).width, 0);
}

function drawCurrent(
  ctx: CanvasRenderingContext2D,
  words: { text: string }[] | null,
  frame: PreviewFrame,
  center: number,
  y: number,
  look: LyricLook,
  fontPx: number,
  edge: number,
): void {
  ctx.font = canvasFont(look, fontPx);
  if (!words || words.length === 0 || frame.wordIndex < 0) {
    paint(ctx, frame.text, center, y, look.color, look.outlineColor, edge);
    return;
  }
  const widths = words.map((word) => ctx.measureText(word.text).width);
  const total = widths.reduce((sum, width) => sum + width, 0);
  let x = center - total / 2;
  ctx.textAlign = "left";
  words.forEach((word, index) => {
    const fill = index <= frame.wordIndex ? look.sungColor : withAlpha(look.color, 0.45);
    paint(ctx, word.text, x, y, fill, look.outlineColor, edge);
    x += widths[index];
  });
  ctx.textAlign = "center";
}

function paint(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
  outline: string,
  width: number,
): void {
  if (width > 0) {
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.lineWidth = width;
    ctx.strokeStyle = outline;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function withAlpha(hexColor: string, alpha: number): string {
  const value = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hexColor}${value}`;
}
