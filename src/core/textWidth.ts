import { fitPercent, frameRoom, letterGap, playWidth } from "./lyricLook";

export type TextMeasurement = { font: string; text: string; em: number };

export function needsTextMeasurement(text: string): boolean {
  return /\p{Script=Latin}/u.test(text);
}

export function measuredEm(rows: TextMeasurement[] | undefined, text: string, font: string): number | undefined {
  const row = rows?.find((item) => item.font === font && item.text === text);
  return row && Number.isFinite(row.em) && row.em > 0 ? row.em : undefined;
}

export function horizontalFitPercent(
  text: string, size: number, tracking: number, outline: number, anchor: number, em?: number,
): number {
  const count = Array.from(text).length;
  if (!needsTextMeasurement(text) || em == null || !Number.isFinite(em) || em <= 0) {
    return fitPercent(count, size, tracking, outline, anchor, playWidth);
  }
  const ink = em * size + Math.max(0, count - 1) * letterGap(tracking) + Math.max(0, outline) * 2;
  const room = frameRoom(anchor, playWidth);
  return ink <= room ? 100 : Math.max(1, Math.floor(room / ink * 100));
}
