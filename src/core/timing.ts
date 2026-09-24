export const RATE_STEP = 0.005;
export const RATE_MIN = 0.85;
export const RATE_MAX = 1.2;
export const STEP_MS = 50;
export const MEDIUM_STEP_MS = 250;
export const FAST_STEP_MS = 1_000;
export const MIN_MS = -300_000;
export const MAX_MS = 300_000;
export const HOLD_DELAY_MS = 400;
export const HOLD_ACCEL_MS = 1_200;
export const HOLD_FAST_MS = 2_500;
export const HOLD_MIN_MS = -30_000;
export const HOLD_MAX_MS = 180_000;

export type AddedLyric = {
  atMs: number;
  text: string;
  id: string;
  trans?: string | null;
};

export type TrackTiming = {
  offsetMs: number;
  rate: number;
  lines: Record<string, number> | null;
  holds: Record<string, number> | null;
  texts: Record<string, string> | null;
  added: AddedLyric[] | null;
  trans: Record<string, string> | null;
};

export function defaultTiming(): TrackTiming {
  return {
    offsetMs: 0,
    rate: 1,
    lines: null,
    holds: null,
    texts: null,
    added: null,
    trans: null,
  };
}

export function isIdentity(t: TrackTiming): boolean {
  return (
    t.offsetMs === 0 &&
    Math.abs(t.rate - 1) < 0.0005 &&
    (!t.lines || Object.keys(t.lines).length === 0) &&
    (!t.holds || Object.keys(t.holds).length === 0) &&
    (!t.texts || Object.keys(t.texts).length === 0) &&
    (!t.added || t.added.length === 0) &&
    (!t.trans || Object.keys(t.trans).length === 0)
  );
}

function copyInts(
  src: Record<string, number> | null,
  min: number,
  max: number,
): Record<string, number> | null {
  if (!src || Object.keys(src).length === 0) return null;
  const d: Record<string, number> = {};
  for (const [k, v] of Object.entries(src)) {
    const n = Math.min(max, Math.max(min, v));
    if (n !== 0) d[k] = n;
  }
  return Object.keys(d).length === 0 ? null : d;
}

function copyStrs(src: Record<string, string> | null): Record<string, string> | null {
  if (!src || Object.keys(src).length === 0) return null;
  return { ...src };
}

export function clamped(t: TrackTiming): TrackTiming {
  const rate = Number.isFinite(t.rate) ? t.rate : 1;
  return {
    offsetMs: Math.min(MAX_MS, Math.max(MIN_MS, t.offsetMs)),
    rate: Math.min(RATE_MAX, Math.max(RATE_MIN, rate)),
    lines: copyInts(t.lines, MIN_MS, MAX_MS),
    holds: copyInts(t.holds, HOLD_MIN_MS, HOLD_MAX_MS),
    texts: copyStrs(t.texts),
    added: t.added && t.added.length > 0 ? t.added.map((a) => ({ ...a })) : null,
    trans: copyStrs(t.trans),
  };
}

function emptyToNull(d: Record<string, number>): Record<string, number> | null {
  return Object.keys(d).length === 0 ? null : d;
}

export function withLineShift(t: TrackTiming, key: string, ms: number): TrackTiming {
  const d = t.lines ? { ...t.lines } : {};
  ms = Math.min(MAX_MS, Math.max(MIN_MS, ms));
  if (ms === 0) delete d[key];
  else d[key] = ms;
  return { ...t, lines: emptyToNull(d) };
}

export function withLineHold(t: TrackTiming, key: string, ms: number): TrackTiming {
  const d = t.holds ? { ...t.holds } : {};
  ms = Math.min(HOLD_MAX_MS, Math.max(HOLD_MIN_MS, ms));
  if (ms === 0) delete d[key];
  else d[key] = ms;
  return { ...t, holds: emptyToNull(d) };
}

export function withLineText(t: TrackTiming, key: string, text: string | null): TrackTiming {
  const d = t.texts ? { ...t.texts } : {};
  if (text == null) delete d[key];
  else d[key] = text;
  return { ...t, texts: Object.keys(d).length === 0 ? null : d };
}

export function withLineTrans(t: TrackTiming, key: string, text: string | null): TrackTiming {
  const d = t.trans ? { ...t.trans } : {};
  if (text == null) delete d[key];
  else d[key] = text;
  return { ...t, trans: Object.keys(d).length === 0 ? null : d };
}

export function withAdded(t: TrackTiming, line: AddedLyric): TrackTiming {
  const list = t.added ? t.added.map((a) => ({ ...a })) : [];
  list.push({ ...line });
  return { ...t, added: list };
}

export function replaceAdded(t: TrackTiming, id: string, line: AddedLyric): TrackTiming {
  if (!t.added || t.added.length === 0) return withAdded(t, line);
  const list: AddedLyric[] = [];
  let found = false;
  for (const a of t.added) {
    if (a.id === id) {
      list.push({ ...line });
      found = true;
    } else list.push({ ...a });
  }
  if (!found) list.push({ ...line });
  return { ...t, added: list };
}

export function withoutAdded(t: TrackTiming, id: string): TrackTiming {
  if (!t.added || t.added.length === 0) return t;
  const list = t.added.filter((a) => a.id !== id);
  return { ...t, added: list.length === 0 ? null : list };
}

export function withoutLine(t: TrackTiming, key: string): TrackTiming {
  let next = withLineTrans(withLineText(withLineHold(withLineShift(t, key, 0), key, 0), key, null), key, null);
  if (key.startsWith("add|")) next = withoutAdded(next, key.slice(4));
  return next;
}

export function stepForHoldMs(heldMs: number): number {
  if (heldMs < HOLD_DELAY_MS) return 0;
  if (heldMs < HOLD_ACCEL_MS) return STEP_MS;
  if (heldMs < HOLD_FAST_MS) return MEDIUM_STEP_MS;
  return FAST_STEP_MS;
}

export function formatOffset(ms: number): string {
  const sign = ms > 0 ? "+" : ms < 0 ? "−" : "±";
  return `${sign}${(Math.abs(ms) / 1000).toFixed(2)}s`;
}
