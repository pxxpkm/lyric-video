import { lyricClockMs, mediaMsForLyric, previewFrame, type PreviewFrame } from "../../core/preview";
import { applyEdits, lyricLine, type LyricLine } from "../../core/lyrics";
import { canvasFont, defaultLook, type LyricLook } from "../../core/lyricLook";
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

export function drawPreview(
  canvas: HTMLCanvasElement,
  lines: LyricLine[],
  mediaMs: number,
  mode: "video" | "audio",
  debug: boolean,
  timing: TrackTiming = defaultTiming(),
  look: LyricLook = defaultLook,
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
  const edge = Math.max(look.outline * scale, look.outline > 0 ? 1 : 0);
  const x = look.x * width;
  const y = look.y * height;
  if (!frame.text) {
    ctx.font = canvasFont(look, Math.max(16, fontPx * 0.7));
    paint(ctx, "尚未有歌詞", x, y, look.color, look.outlineColor, edge);
  } else {
    const line = shown[frame.index];
    drawCurrent(ctx, line?.words ?? null, frame, x, y, look, fontPx, edge);
    if (frame.trans) {
      const transPx = fontPx * look.transScale;
      ctx.font = canvasFont(look, transPx);
      paint(ctx, frame.trans, x, y + fontPx * 1.25, look.color, look.outlineColor, edge);
    }
    if (frame.nextText) {
      const nextPx = fontPx * look.transScale;
      ctx.font = canvasFont(look, nextPx);
      const fade = withAlpha(look.color, look.nextOpacity);
      const edgeFade = withAlpha(look.outlineColor, look.nextOpacity);
      paint(ctx, frame.nextText, x, y + fontPx * 1.25 + nextPx * 1.2, fade, edgeFade, edge);
    }
  }

  if (debug) {
    ctx.textAlign = "left";
    ctx.font = "14px Consolas, 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(8, 10, 14, 0.55)";
    ctx.fillRect(12, 12, 340, 96);
    ctx.fillStyle = "#f3f5f8";
    ctx.fillText(`播放 ${Math.round(mediaMs)} ms`, 20, 28);
    ctx.fillText(`歌詞 ${Math.round(lyricMs)} ms`, 20, 46);
    ctx.fillText(`句 ${Math.round(mediaMsForLyric(frame.atMs, timing.offsetMs, timing.rate))} ms`, 20, 64);
    ctx.fillText(frame.key || "—", 20, 82);
    ctx.fillText(`字 ${frame.wordIndex}`, 220, 82);
  }
  return frame;
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
