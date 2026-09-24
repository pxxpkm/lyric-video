import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fingerprintKeys, titleKeys } from "../core/title";
import {
  MAX_MS,
  MIN_MS,
  type AddedLyric,
  type TrackTiming,
  clamped,
  defaultTiming,
  isIdentity,
} from "../core/timing";

type FileAdded = { AtMs: number; Text: string; Id: string; Trans?: string | null };
type FileTiming = {
  OffsetMs: number;
  Rate: number;
  Lines?: Record<string, number> | null;
  Holds?: Record<string, number> | null;
  Texts?: Record<string, string> | null;
  Added?: FileAdded[] | null;
  Trans?: Record<string, string> | null;
};

function clone(t: TrackTiming): TrackTiming {
  return {
    offsetMs: t.offsetMs,
    rate: t.rate,
    lines: t.lines ? { ...t.lines } : null,
    holds: t.holds ? { ...t.holds } : null,
    texts: t.texts ? { ...t.texts } : null,
    added: t.added ? t.added.map((a) => ({ ...a })) : null,
    trans: t.trans ? { ...t.trans } : null,
  };
}

function fromFile(v: FileTiming): TrackTiming {
  return {
    offsetMs: v.OffsetMs ?? 0,
    rate: v.Rate ?? 1,
    lines: v.Lines && Object.keys(v.Lines).length > 0 ? { ...v.Lines } : null,
    holds: v.Holds && Object.keys(v.Holds).length > 0 ? { ...v.Holds } : null,
    texts: v.Texts && Object.keys(v.Texts).length > 0 ? { ...v.Texts } : null,
    added:
      v.Added && v.Added.length > 0
        ? v.Added.map((a) => ({ atMs: a.AtMs, text: a.Text, id: a.Id, trans: a.Trans ?? null }))
        : null,
    trans: v.Trans && Object.keys(v.Trans).length > 0 ? { ...v.Trans } : null,
  };
}

function toFile(t: TrackTiming): FileTiming {
  const added: FileAdded[] | undefined = t.added?.map((a: AddedLyric) => ({
    AtMs: a.atMs,
    Text: a.text,
    Id: a.id,
    ...(a.trans ? { Trans: a.trans } : {}),
  }));
  return {
    OffsetMs: t.offsetMs,
    Rate: t.rate,
    ...(t.lines ? { Lines: t.lines } : {}),
    ...(t.holds ? { Holds: t.holds } : {}),
    ...(t.texts ? { Texts: t.texts } : {}),
    ...(added ? { Added: added } : {}),
    ...(t.trans ? { Trans: t.trans } : {}),
  };
}

export class OffsetStore {
  private cache: Record<string, TrackTiming> | null = null;

  constructor(private path: string) {}

  reset(path: string): void {
    this.path = path;
    this.cache = null;
  }

  getMs(title: string | null | undefined, artist: string | null | undefined): number {
    return this.getTiming(title, artist).offsetMs;
  }

  getTiming(title: string | null | undefined, artist: string | null | undefined): TrackTiming {
    const dict = this.load();
    if (Object.keys(dict).length === 0) return defaultTiming();
    for (const key of fingerprintKeys(title, artist)) {
      const hit = dict[key];
      if (hit) return clone(hit);
    }
    const wantTitles = titleKeys(title);
    if (wantTitles.length === 0) return defaultTiming();
    let unique: TrackTiming | null = null;
    let uniqueCount = 0;
    for (const [key, value] of Object.entries(dict)) {
      const i = key.indexOf("|");
      const storedTitle = i < 0 ? key : key.slice(i + 1);
      const storedTitles = titleKeys(storedTitle);
      if (!wantTitles.some((w) => storedTitles.includes(w))) continue;
      uniqueCount++;
      unique = value;
    }
    return uniqueCount === 1 && unique ? clone(unique) : defaultTiming();
  }

  setMs(title: string | null | undefined, artist: string | null | undefined, ms: number): void {
    const cur = this.getTiming(title, artist);
    this.setTiming(title, artist, { ...cur, offsetMs: ms });
  }

  setTiming(title: string | null | undefined, artist: string | null | undefined, timing: TrackTiming): void {
    const next = clamped(timing);
    const keys = fingerprintKeys(title, artist);
    if (keys.length === 0) return;
    const dict = this.load();
    const titles = titleKeys(title);
    for (const existing of Object.keys(dict)) {
      if (keys.includes(existing)) continue;
      const i = existing.indexOf("|");
      const storedTitle = i < 0 ? existing : existing.slice(i + 1);
      if (titles.some((t) => titleKeys(storedTitle).includes(t))) delete dict[existing];
    }
    for (const key of keys) {
      if (isIdentity(next)) delete dict[key];
      else dict[key] = clone(next);
    }
    this.cache = dict;
    this.save();
  }

  nudge(title: string | null | undefined, artist: string | null | undefined, deltaMs: number): number {
    const cur = this.getTiming(title, artist);
    const offsetMs = Math.min(MAX_MS, Math.max(MIN_MS, cur.offsetMs + deltaMs));
    this.setTiming(title, artist, { ...cur, offsetMs });
    return offsetMs;
  }

  private load(): Record<string, TrackTiming> {
    if (this.cache) return this.cache;
    this.cache = readFile(this.path);
    return this.cache;
  }

  private save(): void {
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      const snap: Record<string, FileTiming> = {};
      for (const [key, value] of Object.entries(this.cache ?? {})) snap[key] = toFile(value);
      writeFileSync(this.path, JSON.stringify(snap, null, 2));
    } catch {
      /* keep memory */
    }
  }
}

function readFile(path: string): Record<string, TrackTiming> {
  try {
    if (!existsSync(path)) return {};
    const json = readFileSync(path, "utf8");
    if (/"offsetms"/i.test(json) || /"rate"/i.test(json)) {
      const parsed = JSON.parse(json) as Record<string, FileTiming>;
      const dict: Record<string, TrackTiming> = {};
      for (const [key, value] of Object.entries(parsed)) dict[key] = fromFile(value);
      return dict;
    }
    const ints = JSON.parse(json) as Record<string, number>;
    const converted: Record<string, TrackTiming> = {};
    for (const [key, value] of Object.entries(ints)) {
      converted[key] = { ...defaultTiming(), offsetMs: value, rate: 1 };
    }
    return converted;
  } catch {
    return {};
  }
}
