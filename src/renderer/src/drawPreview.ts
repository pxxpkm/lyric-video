import { lyricClockMs, previewFrame, type PreviewFrame } from "../../core/preview";
import { applyEdits, lyricLine, type LyricLine } from "../../core/lyrics";
import { canvasFont, defaultLook, edgeOutlineAt, isVerticalFlow, letterGap, mixHex, softBlur, type LyricLook } from "../../core/lyricLook";
import {
  isDecor,
  lyricBands,
  mediaSpans,
  pointOnBands,
  sampleClip,
  decorLayout,
  sampleDecor,
  sampleTrans,
  verticalColumns,
  DECOR_MARK,
  type MotionClip,
  type Placed,
} from "../../core/motion";
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
  // 飛入只郁畫面。拖曳抓句尾嘅定位，唔跟住飛緊嘅字。
  const restMs = mediaSpans(shown, timing).get(frame.key)?.endMs ?? mediaMs;
  const bands = measureBands(ctx, shown, frame, restMs, timing, look, clips, width, height);
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
  const translated = transPlacement(clips, frame.key, mediaMs, look, shown, timing);
  const edged = clips.find((clip) => clip.lineKey && clip.lineKey === frame.key)?.preset === "edge";
  const x = placed.x * width;
  const y = placed.y * height;
  const transX = translated.x * width;
  const transY = translated.y * height;
  ctx.save();
  ctx.globalAlpha = placed.opacity;
  if (frame.text && look.soft) ctx.filter = `blur(${softBlur * scale}px)`;
  if (!frame.text) {
    ctx.font = canvasFont(look, Math.max(16, fontPx * 0.7));
    paint(ctx, "尚未有歌詞", x, y, look.color, look.outlineColor, edge);
  } else if (isVerticalFlow(look.flow)) {
    const words = shown[frame.index]?.words ?? null;
    const glyphs = mainGlyphs(words, frame, look);
    const bands = verticalColumns(
      x,
      y,
      transX,
      transY,
      fontPx,
      transRatio(look),
      {
        main: glyphs.length,
        trans: Array.from(frame.trans).length,
      },
      trackPx(look, scale),
    );
    drawColumn(ctx, glyphs, bands.main, look, fontPx, edge, placed, hasKaraoke(words, frame) ? 0 : placed.tint, look.outlineColor, edged);
    if (frame.trans && bands.trans) {
      drawColumn(
        ctx,
        Array.from(frame.trans).map((ch) => ({ ch, fill: look.transColor })),
        bands.trans,
        look,
        transPx,
        edge,
        translated,
        translated.tint,
        look.outlineColor,
        edged,
      );
    }
  } else {
    const line = shown[frame.index];
    const words = line?.words ?? null;
    const gap = trackPx(look, scale);
    const bands = measureBands(ctx, shown, frame, mediaMs, timing, look, clips, width, height);
    withPose(ctx, x, y, placed, () => {
      if (gap > 0) drawTracked(ctx, words, frame, x, y, look, fontPx, edge, gap, edged, placed.tint);
      else if (edged) drawEdged(ctx, words, frame, x, y, look, fontPx, edge);
      else if (hasKaraoke(words, frame)) drawCurrent(ctx, words, frame, x, y, look, fontPx, edge);
      else paint(ctx, frame.text, x, y, mixHex(look.color, look.sungColor, placed.tint), look.outlineColor, edge);
    });
    if (frame.trans && bands?.trans) {
      const at = bands.trans;
      withPose(ctx, at.x, at.y, translated, () => {
        ctx.font = canvasFont(look, transPx);
        const fill = mixHex(look.transColor, look.sungColor, translated.tint);
        if (gap > 0) {
          paintRun(
            ctx,
            Array.from(frame.trans).map((ch) => ({ ch, fill })),
            at.x,
            at.y,
            edge,
            look,
            gap,
            edged,
          );
        } else if (edged) {
          paintRun(
            ctx,
            Array.from(frame.trans).map((ch) => ({ ch, fill })),
            at.x,
            at.y,
            edge,
            look,
          );
        } else {
          paint(ctx, frame.trans, at.x, at.y, fill, look.outlineColor, edge);
        }
      });
    }
  }
  ctx.restore();
  const span = mediaSpans(shown, timing).get(frame.key);
  const preset = clips.find((clip) => clip.lineKey && clip.lineKey === frame.key)?.preset;
  if (frame.text && span && isDecor(preset)) {
    const vertical = isVerticalFlow(look.flow);
    drawDecor(ctx, x, y, preset, mediaMs, span.startMs, span.endMs, scale, look.color, look, decorLayout(frame.text, look.size, vertical));
    if (frame.trans) {
      drawDecor(
        ctx,
        transX,
        transY,
        preset,
        mediaMs,
        span.startMs,
        span.endMs,
        scale,
        look.transColor,
        look,
        decorLayout(frame.trans, look.transSize, vertical),
      );
    }
  }
  return frame;
}

function linePlacement(
  clips: MotionClip[],
  key: string,
  mediaMs: number,
  look: LyricLook,
  shown: LyricLine[],
  timing: TrackTiming,
): Placed {
  const bound = clips.find((clip) => clip.lineKey && clip.lineKey === key);
  const span = bound ? mediaSpans(shown, timing).get(key) : undefined;
  if (!bound) return { x: look.x, y: look.y, opacity: 1, scale: 1, deg: 0, tint: 0 };
  return sampleClip(bound, mediaMs, look, span?.startMs ?? bound.startMs, span?.endMs ?? bound.endMs);
}

function transPlacement(
  clips: MotionClip[],
  key: string,
  mediaMs: number,
  look: LyricLook,
  shown: LyricLine[],
  timing: TrackTiming,
): { x: number; y: number; scale: number; deg: number; tint: number } {
  const bound = clips.find((clip) => clip.lineKey && clip.lineKey === key);
  if (!bound) return { x: look.transX, y: look.transY, scale: 1, deg: 0, tint: 0 };
  const span = mediaSpans(shown, timing).get(key);
  return sampleTrans(bound, look, mediaMs, span?.startMs ?? bound.startMs, span?.endMs ?? bound.endMs);
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
  const translated = transPlacement(clips, frame.key, mediaMs, look, shown, timing);
  const gap = trackPx(look, scale);
  if (isVerticalFlow(look.flow)) {
    return verticalColumns(
      placed.x * width,
      placed.y * height,
      translated.x * width,
      translated.y * height,
      fontPx,
      transRatio(look),
      {
        main: mainGlyphs(shown[frame.index]?.words ?? null, frame, look).length,
        trans: Array.from(frame.trans).length,
      },
      gap,
    );
  }
  const words = shown[frame.index]?.words ?? null;
  const edged = clips.find((clip) => clip.lineKey && clip.lineKey === frame.key)?.preset === "edge";
  ctx.font = canvasFont(look, fontPx);
  const main = gap > 0 ? trackedWidth(ctx, words, frame, gap) : edged ? runWidth(ctx, frame.text) : textWidth(ctx, words, frame);
  let trans = 0;
  if (frame.trans) {
    ctx.font = canvasFont(look, transPx);
    trans = gap > 0 ? textGapWidth(ctx, Array.from(frame.trans), gap) : edged ? runWidth(ctx, frame.trans) : ctx.measureText(frame.trans).width;
  }
  return lyricBands(placed.x * width, placed.y * height, translated.x * width, translated.y * height, fontPx, transRatio(look), { main, trans });
}

function transRatio(look: LyricLook): number {
  return look.transSize / look.size;
}

function trackPx(look: LyricLook, scale: number): number {
  return letterGap(look.tracking) * scale;
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

function hasKaraoke(words: { text: string }[] | null, frame: PreviewFrame): boolean {
  return Boolean(words && words.length > 0 && frame.wordIndex >= 0);
}

function drawColumn(
  ctx: CanvasRenderingContext2D,
  glyphs: { ch: string; fill: string }[],
  band: { x: number; y: number; h: number },
  look: LyricLook,
  fontPx: number,
  edge: number,
  pose: { scale: number; deg: number } = { scale: 1, deg: 0 },
  tint = 0,
  outline = look.outlineColor,
  ramp = false,
): void {
  if (glyphs.length === 0) return;
  const step = band.h / glyphs.length;
  const top = band.y - band.h / 2 + step / 2;
  ctx.font = canvasFont(look, fontPx);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // 直排每隻字係獨立事件。放大同擺正繞自己的中心，先至同匯出一樣，字距亦唔會被成條柱拉散。
  glyphs.forEach((glyph, index) => {
    const gx = band.x;
    const gy = top + index * step;
    const fill = tint > 0 ? mixHex(glyph.fill, look.sungColor, tint) : glyph.fill;
    const stroke = ramp ? edgeOutlineAt(look.outlineColor, look.sungColor, index, glyphs.length) : outline;
    withPose(ctx, gx, gy, pose, () => paint(ctx, glyph.ch, gx, gy, fill, stroke, edge));
  });
}

function drawEdged(
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
  const glyphs = hasKaraoke(words, frame)
    ? (words ?? []).flatMap((word, index) =>
        Array.from(word.text).map((ch) => ({
          ch,
          fill: index <= frame.wordIndex ? look.sungColor : withAlpha(look.color, 0.45),
        })),
      )
    : Array.from(frame.text).map((ch) => ({ ch, fill: look.color }));
  paintRun(ctx, glyphs, center, y, edge, look);
}

function drawTracked(
  ctx: CanvasRenderingContext2D,
  words: { text: string }[] | null,
  frame: PreviewFrame,
  center: number,
  y: number,
  look: LyricLook,
  fontPx: number,
  edge: number,
  gap: number,
  ramp: boolean,
  tint: number,
): void {
  ctx.font = canvasFont(look, fontPx);
  const glyphs = hasKaraoke(words, frame)
    ? (words ?? []).flatMap((word, index) =>
        Array.from(word.text).map((ch) => ({
          ch,
          fill: index <= frame.wordIndex ? look.sungColor : withAlpha(look.color, 0.45),
        })),
      )
    : Array.from(frame.text).map((ch) => ({
        ch,
        fill: tint > 0 ? mixHex(look.color, look.sungColor, tint) : look.color,
      }));
  paintRun(ctx, glyphs, center, y, edge, look, gap, ramp);
}

function paintRun(
  ctx: CanvasRenderingContext2D,
  glyphs: { ch: string; fill: string }[],
  center: number,
  y: number,
  edge: number,
  look: LyricLook,
  gap = 0,
  ramp = true,
): void {
  if (glyphs.length === 0) return;
  const widths = glyphs.map((glyph) => ctx.measureText(glyph.ch).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, glyphs.length - 1);
  let x = center - total / 2;
  const align = ctx.textAlign;
  ctx.textAlign = "left";
  glyphs.forEach((glyph, index) => {
    const stroke = ramp ? edgeOutlineAt(look.outlineColor, look.sungColor, index, glyphs.length) : look.outlineColor;
    paint(ctx, glyph.ch, x, y, glyph.fill, stroke, edge);
    x += widths[index];
    if (index < glyphs.length - 1) x += gap;
  });
  ctx.textAlign = align;
}

function withPose(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pose: { scale: number; deg: number },
  draw: () => void,
): void {
  if (pose.scale === 1 && pose.deg === 0) {
    draw();
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  // \frz 正數係逆時針。Canvas 正數係順時針，反號先至同成片同一邊。
  if (pose.deg) ctx.rotate((-pose.deg * Math.PI) / 180);
  if (pose.scale !== 1) ctx.scale(pose.scale, pose.scale);
  ctx.translate(-x, -y);
  draw();
  ctx.restore();
}

function runWidth(ctx: CanvasRenderingContext2D, text: string): number {
  return Array.from(text).reduce((sum, ch) => sum + ctx.measureText(ch).width, 0);
}

function trackedWidth(
  ctx: CanvasRenderingContext2D,
  words: { text: string }[] | null,
  frame: PreviewFrame,
  gap: number,
): number {
  const chars = hasKaraoke(words, frame)
    ? (words ?? []).flatMap((word) => Array.from(word.text))
    : Array.from(frame.text);
  return textGapWidth(ctx, chars, gap);
}

function textGapWidth(ctx: CanvasRenderingContext2D, chars: string[], gap: number): number {
  if (chars.length === 0) return 0;
  const ink = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0);
  return ink + gap * (chars.length - 1);
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

function drawDecor(
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  anchorY: number,
  preset: "dust" | "glow" | "arc",
  mediaMs: number,
  startMs: number,
  endMs: number,
  scale: number,
  fill: string,
  look: LyricLook,
  layout: { axis: "x" | "y"; extent: number; size: number },
): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const dot of sampleDecor(preset, mediaMs, startMs, endMs, layout)) {
    ctx.globalAlpha = dot.opacity;
    ctx.font = canvasFont(look, dot.size * scale);
    paint(ctx, DECOR_MARK, anchorX + dot.x * scale, anchorY + dot.y * scale, fill, fill, 0);
  }
  ctx.restore();
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
