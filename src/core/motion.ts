import { isAttachedTranslationLine, lineDisplayEndMs, lineKey, timeOfMs, type LyricLine } from "./lyrics";
import { mediaMsForLyric } from "./preview";
import type { TrackTiming } from "./timing";

export type MotionFrame = { x: number; y: number; opacity: number };

/** 一句一個。冇有就停住。存檔只存呢個名，取樣時先展開。 */
export const linePresetNames = ["fly", "scale", "turn", "tint", "edge", "dust", "glow", "arc"] as const;
export type LinePreset = (typeof linePresetNames)[number];
export type DecorPreset = "dust" | "glow" | "arc";

export function knownPreset(value: unknown): LinePreset | undefined {
  return linePresetNames.find((item) => item === value);
}

export function isDecor(preset: LinePreset | undefined): preset is DecorPreset {
  return preset === "dust" || preset === "glow" || preset === "arc";
}

/** x、y 係相對成首位置的偏移。畫面位置 = 成首 + 偏移。basis 為 "look" 先當偏移；舊檔沒有 basis 時，x、y 仍是畫面絕對位置。 */
export type MotionClip = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  lineKey: string;
  enter: MotionFrame;
  leave: MotionFrame;
  locked: boolean;
  basis?: "look";
  /** 譯文相對成首譯文位置的偏移。沒有就跟原文偏移，舊檔先係咁。 */
  trans?: { x: number; y: number };
  preset?: LinePreset;
};

export type Placed = { x: number; y: number; opacity: number; scale: number; deg: number; tint: number };

export type Pose = { dy: number; scale: number; deg: number; tint: number };

/** 1080 高的畫面，飛入由定位下面呢幾多像素開始。 */
export const FLY_PX = 72;

export type LyricBand = { x: number; y: number; w: number; h: number };

export function mediaSpans(
  lines: LyricLine[],
  timing: TrackTiming,
): Map<string, { startMs: number; endMs: number }> {
  const map = new Map<string, { startMs: number; endMs: number }>();
  let prevEnd = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.text.trim() || isAttachedTranslationLine(lines, i)) continue;
    const lyricStart = timeOfMs(line, timing.lines);
    const lyricEnd = lineDisplayEndMs(lines, i, timing.lines, timing.holds);
    const visibleStart = Math.max(lyricStart, prevEnd);
    prevEnd = Math.max(prevEnd, lyricEnd);
    if (lyricEnd - visibleStart < 40) continue;
    const startMs = Math.round(mediaMsForLyric(visibleStart, timing.offsetMs, timing.rate));
    const endMs = Math.round(mediaMsForLyric(lyricEnd, timing.offsetMs, timing.rate));
    if (endMs <= startMs) continue;
    map.set(lineKey(line), { startMs, endMs });
  }
  return map;
}

export function settleClip(clip: MotionClip, look: { x: number; y: number }): MotionClip {
  const offset = clip.basis === "look" ? { x: clip.enter.x, y: clip.enter.y } : { x: clip.enter.x - look.x, y: clip.enter.y - look.y };
  return {
    ...clip,
    basis: "look",
    locked: true,
    enter: { ...clip.enter, x: offset.x, y: offset.y },
    leave: { ...clip.leave, x: offset.x, y: offset.y },
    trans: clip.trans ?? { x: offset.x, y: offset.y },
  };
}

export function transOffset(clip: MotionClip): { x: number; y: number } {
  return clip.trans ?? { x: clip.enter.x, y: clip.enter.y };
}

export function sampleTrans(
  clip: MotionClip,
  look: { transX: number; transY: number },
  mediaMs?: number,
  startMs = clip.startMs,
  endMs = clip.endMs,
): { x: number; y: number; scale: number; deg: number; tint: number } {
  const offset = transOffset(clip);
  const pose = mediaMs == null ? restPose() : samplePose(clip.preset, mediaMs, startMs, endMs);
  return {
    x: look.transX + offset.x,
    y: look.transY + offset.y + pose.dy,
    scale: pose.scale,
    deg: pose.deg,
    tint: pose.tint,
  };
}

export function restPose(): Pose {
  return { dy: 0, scale: 1, deg: 0, tint: 0 };
}

/** 飛入：最多 350 毫秒，唔長過句長四分之一，最短 120，亦唔可以長過句長。 */
export function flyMs(spanMs: number): number {
  const span = Math.max(0, spanMs);
  return Math.round(Math.min(span, Math.max(120, Math.min(350, span / 4))));
}

export function pulseMs(spanMs: number): number {
  return Math.round(Math.min(300, Math.max(0, spanMs)));
}

export function tintMs(spanMs: number): number {
  return Math.round(Math.max(0, spanMs) * 0.4);
}

export function samplePose(preset: LinePreset | undefined, mediaMs: number, startMs: number, endMs: number): Pose {
  const rest = restPose();
  if (!preset) return rest;
  const span = Math.max(0, endMs - startMs);
  const elapsed = Math.min(Math.max(0, mediaMs - startMs), span);
  if (preset === "fly") {
    const dur = flyMs(span);
    const t = dur <= 0 ? 1 : Math.min(1, elapsed / dur);
    return { ...rest, dy: (FLY_PX / 1080) * (1 - t) };
  }
  if (preset === "scale") {
    const dur = pulseMs(span);
    const t = dur <= 0 ? 1 : Math.min(1, elapsed / dur);
    return { ...rest, scale: 0.82 + 0.18 * t };
  }
  if (preset === "turn") {
    const dur = pulseMs(span);
    const t = dur <= 0 ? 1 : Math.min(1, elapsed / dur);
    return { ...rest, deg: -6 * (1 - t) };
  }
  if (preset === "tint") {
    const dur = tintMs(span);
    const t = dur <= 0 ? 1 : Math.min(1, elapsed / dur);
    return { ...rest, tint: t };
  }
  return rest;
}

export function sampleClip(
  clip: MotionClip,
  mediaMs: number,
  look: { x: number; y: number },
  startMs = clip.startMs,
  endMs = clip.endMs,
): Placed {
  const span = Math.max(1, endMs - startMs);
  const t = Math.min(1, Math.max(0, (mediaMs - startMs) / span));
  const pose = samplePose(clip.preset, mediaMs, startMs, endMs);
  return {
    x: look.x + clip.enter.x,
    y: look.y + clip.enter.y + pose.dy,
    opacity: lerp(clip.enter.opacity, clip.leave.opacity, t),
    scale: pose.scale,
    deg: pose.deg,
    tint: pose.tint,
  };
}

export function assFadeTag(clip: MotionClip, startMs = clip.startMs, endMs = clip.endMs): string {
  const dur = Math.max(0, Math.round(endMs - startMs));
  const a0 = assAlpha(clip.enter.opacity);
  const a1 = assAlpha(clip.leave.opacity);
  return a0 === 0 && a1 === 0 ? "" : `\\fade(${a0},${a1},${a1},0,${dur},${dur},${dur})`;
}

/** 定位上的預設標籤。飛入只寫 \move，唔再加 \pos。變色由呼叫端決定加唔加。 */
export function assPoseTags(preset: LinePreset | undefined, x: number, y: number, spanMs: number): string {
  const pos = `\\pos(${x},${y})`;
  if (preset === "fly") {
    return `\\move(${x},${y + FLY_PX},${x},${y},0,${flyMs(spanMs)})`;
  }
  if (preset === "scale") {
    return `${pos}\\fscx82\\fscy82\\t(0,${pulseMs(spanMs)},\\fscx100\\fscy100)`;
  }
  if (preset === "turn") {
    return `${pos}\\frz-6\\t(0,${pulseMs(spanMs)},\\frz0)`;
  }
  return pos;
}

export function assMotion(
  clip: MotionClip,
  look: { x: number; y: number },
  startMs = clip.startMs,
  endMs = clip.endMs,
  extra = "",
): string {
  const x = Math.round((look.x + clip.enter.x) * 1920);
  const y = Math.round((look.y + clip.enter.y) * 1080);
  return wrapAnchor(clip, x, y, startMs, endMs, extra);
}

export function assTransMotion(
  clip: MotionClip,
  look: { transX: number; transY: number },
  startMs = clip.startMs,
  endMs = clip.endMs,
  extra = "",
): string {
  const offset = transOffset(clip);
  const x = Math.round((look.transX + offset.x) * 1920);
  const y = Math.round((look.transY + offset.y) * 1080);
  return wrapAnchor(clip, x, y, startMs, endMs, extra);
}

function wrapAnchor(clip: MotionClip, x: number, y: number, startMs: number, endMs: number, extra: string): string {
  return `{\\an5${assPoseTags(clip.preset, x, y, endMs - startMs)}${extra}${assFadeTag(clip, startMs, endMs)}}`;
}

/** 裝飾小點。座標係 1080 畫面相對定位的像素。歌詞本身唔用呢組點。 */
export const DECOR_MARK = "●";

export type DecorDot = {
  x: number;
  y: number;
  x2: number;
  y2: number;
  size: number;
  opacity0: number;
  opacity1: number;
  delayMs: number;
  attackMs: number;
  moveMs: number;
};

/** 橫排沿字寬鋪，直排沿字柱高鋪。預覽同匯出都用字數乘字級，唔用畫面量度。 */
export type DecorLayout = { axis: "x" | "y"; extent: number; size: number };

export function decorLayout(text: string, size: number, vertical: boolean): DecorLayout {
  const count = Math.max(1, Array.from(text).length);
  const nominal = Number.isFinite(size) && size > 0 ? size : 64;
  return { axis: vertical ? "y" : "x", extent: count * nominal, size: nominal };
}

function lineSlots(count: number, extent: number): number[] {
  if (count <= 1) return [0];
  const half = extent / 2;
  return Array.from({ length: count }, (_, index) => Math.round(-half + (extent * index) / (count - 1)));
}

function onAxis(axis: "x" | "y", along: number, cross: number): { x: number; y: number } {
  return axis === "x" ? { x: along, y: cross } : { x: cross, y: along };
}

const DUST_WOBBLE = [0, 0.18, 0.06, 0.24, 0.1, 0.2];

function speckCount(extent: number, size: number, every: number, floor: number, cap: number): number {
  return Math.min(cap, Math.max(floor, Math.round(extent / Math.max(1, size * every))));
}

function speckSize(preset: DecorPreset, index: number): number {
  if (preset === "glow") return index % 2 === 0 ? 20 : 26;
  if (preset === "arc") return 10;
  return index % 3 === 1 ? 14 : 10;
}

/** 錯開寫死。每次播放同一組點，預覽同匯出先至對得上。 */
function dotClock(index: number, span: number, travel: number): { delayMs: number; attackMs: number; moveMs: number } {
  const spanR = Math.max(0, Math.round(span));
  if (spanR <= 0) return { delayMs: 0, attackMs: 0, moveMs: 0 };
  const step = Math.min(120, Math.max(1, Math.round(spanR * 0.06)));
  const delayMs = Math.min(Math.round(spanR * 0.36), (index % 5) * step);
  const room = Math.max(1, spanR - delayMs);
  const moveMs = Math.min(room, travel);
  const attackMs = Math.min(160, moveMs, Math.max(40, Math.round(room * 0.18)));
  return { delayMs, attackMs, moveMs };
}

export function decorDots(preset: LinePreset | undefined, spanMs: number, layout: DecorLayout): DecorDot[] {
  if (!isDecor(preset)) return [];
  const span = Math.max(0, spanMs);
  const opacity0 = preset === "glow" ? 0.36 : preset === "arc" ? 0.6 : 0.55;
  const opacity1 = preset === "glow" ? 0.14 : 0;
  const travel = preset === "dust" ? 1200 : preset === "glow" ? 1500 : 1300;
  return decorPairs(preset, layout).map(([x, y, x2, y2], index) => ({
    x,
    y,
    x2,
    y2,
    size: speckSize(preset, index),
    opacity0,
    opacity1,
    ...dotClock(index, span, travel),
  }));
}

function decorPairs(preset: DecorPreset, layout: DecorLayout): Array<readonly [number, number, number, number]> {
  const { size, extent, axis } = layout;
  if (preset === "arc") {
    const count = speckCount(extent, size, 0.48, 8, 16);
    const path = lineSlots(count + 1, extent);
    const gap = Math.round(size * 0.5);
    const bow = Math.min(Math.round(size * 0.4), Math.max(Math.round(size * 0.16), Math.round(extent * 0.04)));
    const cross = (index: number) => {
      const t = path.length <= 1 ? 0 : index / (path.length - 1);
      return Math.round(gap + bow * (4 * t * (1 - t)));
    };
    return path.slice(0, -1).map((_, index) => {
      const start = onAxis(axis, path[index], cross(index));
      const end = onAxis(axis, path[index + 1], cross(index + 1));
      return [start.x, start.y, end.x, end.y] as const;
    });
  }
  const count = preset === "dust" ? speckCount(extent, size, 0.42, 8, 20) : speckCount(extent, size, 1.35, 3, 7);
  const along = lineSlots(count, extent);
  const gap = Math.round(size * (preset === "dust" ? 0.42 : 0.72));
  const drift = Math.round(size * (preset === "dust" ? 0.22 : 0.12));
  const alongDrift = preset === "glow" ? Math.round(size * 0.08) : 0;
  return along.map((at, index) => {
    const wobble = preset === "dust" ? Math.round(size * DUST_WOBBLE[index % DUST_WOBBLE.length]) : 0;
    const sign = preset === "dust" && axis === "x" ? -1 : index % 2 === 0 ? 1 : -1;
    const cross = sign * (gap + wobble);
    const start = onAxis(axis, at, cross);
    const end = onAxis(axis, at + alongDrift, cross + sign * drift);
    return [start.x, start.y, end.x, end.y] as const;
  });
}

export function sampleDecor(
  preset: LinePreset | undefined,
  mediaMs: number,
  startMs: number,
  endMs: number,
  layout: DecorLayout,
): { x: number; y: number; opacity: number; size: number }[] {
  const span = Math.max(0, endMs - startMs);
  const elapsed = Math.min(Math.max(0, mediaMs - startMs), span);
  return decorDots(preset, span, layout).map((dot) => {
    const move = decorMoveWindow(dot, span);
    const moveT =
      move.t2 <= move.t1 || elapsed <= move.t1 ? 0 : elapsed >= move.t2 ? 1 : (elapsed - move.t1) / (move.t2 - move.t1);
    return {
      x: dot.x + (dot.x2 - dot.x) * moveT,
      y: dot.y + (dot.y2 - dot.y) * moveT,
      opacity: decorOpacityAt(dot, elapsed, span),
      size: dot.size,
    };
  });
}

export function decorMoveWindow(dot: Pick<DecorDot, "delayMs" | "moveMs">, spanMs: number): { t1: number; t2: number } {
  const span = Math.max(0, Math.round(spanMs));
  const t1 = Math.min(span, Math.max(0, Math.round(dot.delayMs)));
  const t2 = Math.min(span, t1 + Math.max(0, Math.round(dot.moveMs)));
  return { t1, t2: Math.max(t1, t2) };
}

function fadeMarks(dot: Pick<DecorDot, "delayMs" | "attackMs" | "moveMs">, spanMs: number): { t1: number; t2: number; t3: number; t4: number } {
  const span = Math.max(0, Math.round(spanMs));
  const t1 = Math.min(span, Math.max(0, Math.round(dot.delayMs)));
  const t2 = Math.min(span, t1 + Math.max(0, Math.round(dot.attackMs)));
  const t3 = Math.min(span, Math.max(t2, t1 + Math.max(0, Math.round(dot.moveMs))));
  return { t1, t2, t3, t4: span };
}

function decorOpacityAt(dot: Pick<DecorDot, "opacity0" | "opacity1" | "delayMs" | "attackMs" | "moveMs">, elapsed: number, spanMs: number): number {
  const { t1, t2, t3, t4 } = fadeMarks(dot, spanMs);
  if (elapsed <= t1) return 0;
  if (elapsed <= t2) return t2 <= t1 ? dot.opacity0 : dot.opacity0 * ((elapsed - t1) / (t2 - t1));
  if (elapsed <= t3) return dot.opacity0;
  if (t4 <= t3) return dot.opacity1;
  return dot.opacity0 + (dot.opacity1 - dot.opacity0) * Math.min(1, (elapsed - t3) / (t4 - t3));
}

export function decorFadeTag(dot: Pick<DecorDot, "opacity0" | "opacity1" | "delayMs" | "attackMs" | "moveMs">, spanMs: number): string {
  const { t1, t2, t3, t4 } = fadeMarks(dot, spanMs);
  return `\\fade(255,${assAlpha(dot.opacity0)},${assAlpha(dot.opacity1)},${t1},${t2},${t3},${t4})`;
}

export function placeLineClip(
  clips: MotionClip[],
  lineKey: string,
  text: string,
  startMs: number,
  endMs: number,
  x: number,
  y: number,
  look: { x: number; y: number },
): MotionClip[] {
  return setLinePosition(clips, lineKey, text, startMs, endMs, x, y, look);
}

export function setLinePosition(
  clips: MotionClip[],
  lineKey: string,
  text: string,
  startMs: number,
  endMs: number,
  x: number,
  y: number,
  look: { x: number; y: number },
): MotionClip[] {
  const nx = clampX(x) - look.x;
  const ny = clampY(y) - look.y;
  const existing = clips.find((clip) => clip.lineKey === lineKey);
  if (!existing) {
    const here = { x: nx, y: ny, opacity: 1 };
    return [...clips, { ...lineClip(lineKey, text, startMs, endMs, here, { ...here }), trans: { x: 0, y: 0 } }];
  }
  return clips.map((clip) => {
    if (clip.lineKey !== lineKey) return clip;
    return {
      ...clip,
      text,
      startMs,
      endMs,
      locked: true,
      basis: "look" as const,
      enter: { ...clip.enter, x: nx, y: ny },
      leave: { ...clip.leave, x: nx, y: ny },
      trans: clip.trans ?? { x: clip.enter.x, y: clip.enter.y },
    };
  });
}

export function placeTransClip(
  clips: MotionClip[],
  lineKey: string,
  text: string,
  startMs: number,
  endMs: number,
  x: number,
  y: number,
  look: { transX: number; transY: number },
): MotionClip[] {
  return setTransPosition(clips, lineKey, text, startMs, endMs, x, y, look);
}

export function setTransPosition(
  clips: MotionClip[],
  lineKey: string,
  text: string,
  startMs: number,
  endMs: number,
  x: number,
  y: number,
  look: { transX: number; transY: number },
): MotionClip[] {
  const nx = clampX(x) - look.transX;
  const ny = clampY(y) - look.transY;
  const existing = clips.find((clip) => clip.lineKey === lineKey);
  if (!existing) {
    const here = { x: 0, y: 0, opacity: 1 };
    return [...clips, { ...lineClip(lineKey, text, startMs, endMs, here, { ...here }), trans: { x: nx, y: ny } }];
  }
  return clips.map((clip) => {
    if (clip.lineKey !== lineKey) return clip;
    return { ...clip, text, startMs, endMs, locked: true, basis: "look" as const, trans: { x: nx, y: ny } };
  });
}

export function setLineFade(
  clips: MotionClip[],
  lineKey: string,
  text: string,
  startMs: number,
  endMs: number,
  edge: "in" | "out",
  amount: number,
): MotionClip[] {
  const opacity = 1 - clamp01(amount);
  const existing = clips.find((clip) => clip.lineKey === lineKey);
  if (!existing) {
    const frame = { x: 0, y: 0, opacity: 1 };
    const enter = { ...frame, opacity: edge === "in" ? opacity : 1 };
    const leave = { ...frame, opacity: edge === "out" ? opacity : 1 };
    return [...clips, { ...lineClip(lineKey, text, startMs, endMs, enter, leave), trans: { x: 0, y: 0 } }];
  }
  return clips.map((clip) => {
    if (clip.lineKey !== lineKey) return clip;
    return edge === "in"
      ? { ...clip, text, startMs, endMs, enter: { ...clip.enter, opacity } }
      : { ...clip, text, startMs, endMs, leave: { ...clip.leave, opacity } };
  });
}

export function setLinePreset(
  clips: MotionClip[],
  lineKey: string,
  text: string,
  startMs: number,
  endMs: number,
  preset: LinePreset | null,
): MotionClip[] {
  const existing = clips.find((clip) => clip.lineKey === lineKey);
  if (!existing) {
    if (!preset) return clips;
    const frame = { x: 0, y: 0, opacity: 1 };
    return [...clips, { ...lineClip(lineKey, text, startMs, endMs, frame, { ...frame }), trans: { x: 0, y: 0 }, preset }];
  }
  return clips.map((clip) => {
    if (clip.lineKey !== lineKey) return clip;
    const next = { ...clip, text, startMs, endMs };
    if (preset) return { ...next, preset };
    delete next.preset;
    return next;
  });
}

export function setLinesPreset(
  clips: MotionClip[],
  lines: { lineKey: string; text: string; startMs: number; endMs: number }[],
  preset: LinePreset | null,
): MotionClip[] {
  return lines.reduce(
    (next, line) => setLinePreset(next, line.lineKey, line.text, line.startMs, line.endMs, preset),
    clips,
  );
}

export function clearLineMotion(clips: MotionClip[], lineKey: string): MotionClip[] {
  return clips.filter((clip) => clip.lineKey !== lineKey);
}

export function setLinesFade(
  clips: MotionClip[],
  lines: { lineKey: string; text: string; startMs: number; endMs: number }[],
  edge: "in" | "out",
  amount: number,
): MotionClip[] {
  return lines.reduce(
    (next, line) => setLineFade(next, line.lineKey, line.text, line.startMs, line.endMs, edge, amount),
    clips,
  );
}

export function clearLineMotions(clips: MotionClip[], lineKeys: string[]): MotionClip[] {
  const drop = new Set(lineKeys);
  return clips.filter((clip) => !drop.has(clip.lineKey));
}

export function addFreeClip(
  clips: MotionClip[],
  text: string,
  startMs: number,
  endMs: number,
  at: { x: number; y: number },
): MotionClip[] {
  const frame = { x: clampX(at.x), y: clampY(at.y), opacity: 1 };
  return [
    ...clips,
    {
      id: `free:${clips.length}:${startMs}`,
      text: text.trim(),
      startMs: Math.round(startMs),
      endMs: Math.round(endMs),
      lineKey: "",
      enter: frame,
      leave: { ...frame },
      locked: true,
      basis: "look",
    },
  ];
}

export function lyricBands(
  origX: number,
  origY: number,
  transX: number,
  transY: number,
  fontPx: number,
  transScale: number,
  widths: { main: number; trans: number },
): { main: LyricBand; trans: LyricBand | null } {
  const transPx = fontPx * transScale;
  return {
    main: { x: origX, y: origY, w: widths.main, h: fontPx },
    trans: widths.trans > 0 ? { x: transX, y: transY, w: widths.trans, h: transPx } : null,
  };
}

export function verticalColumns(
  origX: number,
  origY: number,
  transX: number,
  transY: number,
  fontPx: number,
  transScale: number,
  counts: { main: number; trans: number },
  trackingPx = 0,
): { main: LyricBand; trans: LyricBand | null } {
  const transPx = fontPx * transScale;
  const mainCount = Math.max(1, counts.main);
  const gap = Number.isFinite(trackingPx) ? Math.max(0, trackingPx) : 0;
  const mainStep = fontPx + gap;
  const transStep = transPx + gap;
  return {
    main: { x: origX, y: origY, w: fontPx, h: mainCount * mainStep },
    trans: counts.trans > 0 ? { x: transX, y: transY, w: transPx, h: counts.trans * transStep } : null,
  };
}

export function pointOnBands(point: { x: number; y: number }, bands: Array<LyricBand | null>, pad = 8): boolean {
  return bands.some((band) => {
    if (!band) return false;
    const left = band.x - band.w / 2 - pad;
    const right = band.x + band.w / 2 + pad;
    const top = band.y - band.h / 2 - pad;
    const bottom = band.y + band.h / 2 + pad;
    return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
  });
}

function lineClip(
  lineKey: string,
  text: string,
  startMs: number,
  endMs: number,
  enter: MotionFrame,
  leave: MotionFrame,
): MotionClip {
  return { id: `line:${lineKey}`, text, startMs, endMs, lineKey, enter, leave, locked: true, basis: "look" };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function assAlpha(opacity: number): number {
  return Math.round((1 - Math.min(1, Math.max(0, opacity))) * 255);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function clampX(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function clampY(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(0.98, Math.max(0.02, value));
}

