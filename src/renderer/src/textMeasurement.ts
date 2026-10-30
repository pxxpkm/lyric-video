import { canvasFont, type LyricLook } from "../../core/lyricLook";
import { needsTextMeasurement, type TextMeasurement } from "../../core/textWidth";
import type { LyricLine } from "../../core/lyrics";

const cache = new Map<string, number>();
let context: CanvasRenderingContext2D | null = null;
let listening = false;

export function clearTextMeasurements(): void { cache.clear(); }

export function measureTextEm(text: string, font: string, look: LyricLook): number | undefined {
  if (!needsTextMeasurement(text)) return undefined;
  if (typeof document === "undefined") return undefined;
  if (!listening) {
    document.fonts.addEventListener("loadingdone", () => cache.clear());
    listening = true;
  }
  const key = `${font}\0${text}`;
  const saved = cache.get(key);
  if (saved != null) return saved;
  context ??= document.createElement("canvas").getContext("2d");
  if (!context) return undefined;
  context.font = canvasFont(look, 64, font);
  // 逐字裙邊／字距會分字畫。取整句與分字總寬較大者，避免字偶距令某個模式超框。
  const em = Math.max(context.measureText(text).width, Array.from(text).reduce((sum, ch) => sum + context!.measureText(ch).width, 0)) / 64;
  if (!(em > 0) || !Number.isFinite(em)) return undefined;
  if (cache.size >= 2000) cache.clear();
  cache.set(key, em);
  return em;
}

export function collectTextMeasurements(lines: LyricLine[], look: LyricLook): TextMeasurement[] {
  const rows = new Map<string, TextMeasurement>();
  for (const line of lines) {
    for (const [text, font] of [[line.text, look.font], [line.translatedText ?? "", look.transFont]]) {
      for (const variant of new Set([text, text.trim()])) {
        const em = measureTextEm(variant, font, look);
        if (em != null) rows.set(`${font}\0${variant}`, { font, text: variant, em });
      }
    }
  }
  return [...rows.values()];
}
