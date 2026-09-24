import { lyricClockMs, mediaMsForLyric, previewFrame, type PreviewFrame } from "../../core/preview";
import { applyEdits, lyricLine, type LyricLine } from "../../core/lyrics";
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
  const center = width / 2;
  if (!frame.text) {
    ctx.fillStyle = "#d5dbe4";
    ctx.font = "32px 'Microsoft JhengHei', 'Segoe UI', sans-serif";
    ctx.fillText("尚未有歌詞", center, height * 0.62);
  } else {
    const line = shown[frame.index];
    drawCurrent(ctx, line?.words ?? null, frame, center, height * 0.62);
    if (frame.trans) {
      ctx.fillStyle = "#c5d0dc";
      ctx.font = "24px 'Microsoft JhengHei', 'Segoe UI', sans-serif";
      ctx.fillText(frame.trans, center, height * 0.74);
    }
    if (frame.nextText) {
      ctx.fillStyle = "rgba(215, 220, 228, 0.45)";
      ctx.font = "22px 'Microsoft JhengHei', 'Segoe UI', sans-serif";
      ctx.fillText(frame.nextText, center, height * 0.86);
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
): void {
  ctx.font = "42px 'Microsoft JhengHei', 'Segoe UI', sans-serif";
  if (!words || words.length === 0 || frame.wordIndex < 0) {
    ctx.fillStyle = "#f3f5f8";
    ctx.fillText(frame.text, center, y);
    return;
  }
  const widths = words.map((word) => ctx.measureText(word.text).width);
  const total = widths.reduce((sum, width) => sum + width, 0);
  let x = center - total / 2;
  ctx.textAlign = "left";
  words.forEach((word, index) => {
    ctx.fillStyle = index <= frame.wordIndex ? "#f0d78c" : "rgba(243,245,248,0.38)";
    ctx.fillText(word.text, x, y);
    x += widths[index];
  });
  ctx.textAlign = "center";
}
