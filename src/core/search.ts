import type { LyricCandidate } from "./candidate";
import { usableTrackDuration } from "./lyrics";

export type LyricProvider = {
  search(title: string, artist: string): Promise<LyricCandidate[]>;
};

const TIMEOUT_MS = 8_000;

async function searchOne(
  provider: LyricProvider,
  title: string,
  artist: string,
  timeoutMs: number,
): Promise<LyricCandidate[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      provider.search(title, artist),
      new Promise<LyricCandidate[]>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
  } catch {
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function collectCandidates(
  providers: LyricProvider[],
  title: string,
  artist: string,
  timeoutMs = TIMEOUT_MS,
): Promise<LyricCandidate[]> {
  const bags = await Promise.all(providers.map((provider) => searchOne(provider, title, artist, timeoutMs)));
  const seen = new Set<string>();
  const list: LyricCandidate[] = [];
  for (const bag of bags) {
    for (const item of bag) {
      const key = item.key.toLowerCase();
      if (!item.key || seen.has(key)) continue;
      seen.add(key);
      list.push(item);
    }
  }
  return list;
}

export function rankCandidates(candidates: LyricCandidate[], durationMs: number | null): LyricCandidate[] {
  const usable = usableTrackDuration(durationMs);
  if (usable == null) return [...candidates];
  return [...candidates].sort((a, b) => {
    const delta = durationDelta(a.durationMs, usable) - durationDelta(b.durationMs, usable);
    if (delta !== 0) return delta;
    return a.title.localeCompare(b.title, undefined, { sensitivity: "accent" });
  });
}

function durationDelta(songMs: number, trackMs: number): number {
  if (songMs < 8_000) return 10_000;
  return Math.abs(songMs - trackMs) / 1000;
}
