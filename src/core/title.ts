import { convert } from "./s2t";
import { hasKana } from "./text";

const songSlashArtist = /[（(]\s*([^／/）)]+?)\s*[／/]\s*([^）)]+?)\s*[）)]/g;
const campaignBrackets = /\s*【.*?】\s*/g;
const trailingJunk = /\s*[([（【].*?[)\]）】]\s*$/;
const leadingTrackNo = /^\d+[.．、]\s*/;
const topicSuffix = /\s*-\s*topic$/i;
const quotedJp = /[「『]([^」』]{2,})[」』]/;

export function norm(raw: string | null | undefined): string {
  let s = (raw ?? "").trim();
  if (!s) return s;
  try {
    s = s.normalize("NFKC");
  } catch {
    /* keep the original */
  }
  if (!hasKana(s)) s = convert(s) ?? s;
  s = s.toLowerCase();
  s = s.replace(/\s+/g, " ");
  s = s.replace(/\s*-\s*/g, "-");
  return s;
}

export function looksLikeTvSize(title: string | null | undefined): boolean {
  const t = title ?? "";
  return (
    t.toLowerCase().includes("tvサイズ") ||
    t.toLowerCase().includes("tv size") ||
    t.toLowerCase().includes("tv-size") ||
    /\(tv\)/i.test(t)
  );
}

export function looksLikeTvOp(title: string | null | undefined): boolean {
  const t = title ?? "";
  return (
    t.toLowerCase().includes("op映像") ||
    t.toLowerCase().includes("ed映像") ||
    t.includes("後期OP") ||
    t.includes("前期OP") ||
    t.includes("ノンクレジット") ||
    t.includes("オープニング") ||
    looksLikeTvSize(t)
  );
}

export function extractQuotedSong(title: string | null | undefined): string | null {
  const m = quotedJp.exec(title ?? "");
  quotedJp.lastIndex = 0;
  if (!m) return null;
  const song = m[1].trim();
  return song.length >= 2 ? song : null;
}

function firstSlash(title: string | null | undefined): RegExpExecArray | null {
  return new RegExp(songSlashArtist.source, "g").exec(norm(title));
}

export function extractParenSong(title: string | null | undefined): string | null {
  const m = firstSlash(title);
  if (!m) return null;
  const song = m[1].trim();
  return song.length >= 2 ? song : null;
}

export function extractParenArtist(title: string | null | undefined): string | null {
  const m = firstSlash(title);
  if (!m) return null;
  const artist = m[2].trim();
  return artist.length >= 2 ? artist : null;
}

function stripCampaign(s: string): string {
  return s.replace(campaignBrackets, " ").trim();
}

export function searchTitle(title: string | null | undefined): string {
  let song = extractParenSong(title);
  if (!song) song = extractQuotedSong(title);
  if (!song) {
    song = stripCampaign(norm(title));
    song = song.replace(leadingTrackNo, "").trim();
  }
  if (!song) song = (title ?? "").trim();
  if (looksLikeTvOp(title) && !looksLikeTvSize(song)) song += " TVサイズ";
  return song;
}

export function looksLikeChannel(artist: string | null | undefined): boolean {
  const a = artist ?? "";
  if (!a) return true;
  if (a.includes("/") || a.includes("／") || a.includes("✕") || a.includes("×")) return true;
  if (a.toLowerCase().includes("topic")) return true;
  if (a.toLowerCase().includes("official")) return true;
  if (a.toLowerCase().includes("anime")) return true;
  return false;
}

export function searchArtist(title: string | null | undefined, artist: string | null | undefined): string {
  const paren = extractParenArtist(title);
  const a = (artist ?? "").trim().replace(topicSuffix, "").trim();
  if (paren && (!a || looksLikeChannel(a))) return paren;
  return a;
}

export function normArtist(raw: string | null | undefined): string {
  let s = (raw ?? "").trim();
  for (const sep of ["/", "／", ",", "、", "&", " feat.", " ft.", " feat ", " ft "]) {
    const i = s.toLowerCase().indexOf(sep.toLowerCase());
    if (i > 0) s = s.slice(0, i).trim();
  }
  s = s.replace(topicSuffix, "").trim();
  return norm(s);
}

export function titleKeys(raw: string | null | undefined): string[] {
  const list: string[] = [];
  const add = (value: string | null | undefined) => {
    let s = (value ?? "").trim();
    if (!s) return;
    s = s.replace(leadingTrackNo, "").trim();
    if (!s || list.includes(s)) return;
    list.push(s);
  };
  const n = norm(raw);
  add(n);
  add(stripCampaign(n));
  for (const m of n.matchAll(new RegExp(songSlashArtist.source, "g"))) add(norm(m[1]));
  let stripped = n;
  for (let i = 0; i < 3; i++) {
    const next = stripped.replace(trailingJunk, "").trim();
    if (next === stripped) break;
    stripped = next;
    add(stripped);
  }
  return list;
}

function artistKeys(artist: string | null | undefined, title: string | null | undefined): string[] {
  const list: string[] = [];
  const add = (value: string | null | undefined) => {
    if (!value || !value.trim()) return;
    const s = normArtist(value);
    if (!s || list.includes(s)) return;
    list.push(s);
  };
  add(artist);
  add(extractParenArtist(title));
  if (list.length === 0) list.push("");
  return list;
}

export function allKeys(title: string | null | undefined, artist: string | null | undefined): string[] {
  const keys: string[] = [];
  for (const t of titleKeys(title)) {
    for (const a of artistKeys(artist, title)) {
      const key = `${a}|${t}`;
      if (key.endsWith("|") || keys.includes(key)) continue;
      keys.push(key);
    }
  }
  return keys;
}

export function fingerprintKeys(title: string | null | undefined, artist: string | null | undefined): string[] {
  return allKeys(title, artist);
}

function containsSong(haystack: string, needle: string): boolean {
  if (needle.length < 5 || haystack.length < needle.length) return false;
  return haystack.includes(needle);
}

function titlesOverlap(
  want: string[],
  stored: string[],
  rawWant: string | null | undefined,
  rawStored: string | null | undefined,
): boolean {
  for (const w of want) {
    for (const s of stored) {
      if (w === s) return true;
      if (containsSong(w, s) || containsSong(s, w)) return true;
    }
  }
  const a = norm(rawWant);
  const b = norm(rawStored);
  return containsSong(a, b) || containsSong(b, a);
}

function artistsMatch(a: string, b: string): boolean {
  return a === b || a.includes(b) || b.includes(a);
}

function splitKey(key: string): [string, string] {
  const i = key.indexOf("|");
  if (i < 0) return ["", key];
  return [key.slice(0, i), key.slice(i + 1)];
}

export type SavedChoice = {
  candidateKey: string;
  title: string;
  artist: string;
  keys: string[];
  sourceLabel: string;
};

function sourceLabel(candidateKey: string): string {
  switch (candidateKey.split(":")[0]) {
    case "ncm":
      return "網易雲";
    case "qq":
      return "QQ";
    case "kg":
      return "酷狗";
    case "lrc":
      return "LRCLIB";
    default:
      return candidateKey.split(":")[0] ?? "";
  }
}

function looksLikeChannelName(a: string): boolean {
  const lower = a.toLowerCase();
  return (
    lower.includes("topic") ||
    lower.includes("official") ||
    lower.includes("anime") ||
    a.includes("/") ||
    a.includes("／") ||
    a.includes("✕")
  );
}

export function savedChoiceFrom(candidateKey: string, keys: string[]): SavedChoice {
  const parsed = keys.map((k) => {
    const [artist, title] = splitKey(k);
    return { artist, title, display: searchTitle(title) };
  });
  const title =
    parsed.map((p) => p.title).find((t) => looksLikeTvSize(t)) ??
    parsed.map((p) => extractParenSong(p.title)).find((t) => !!t) ??
    [...parsed.map((p) => p.display)]
      .filter((t) => t.length > 0 && t.length < 70 && !t.includes("映像"))
      .sort((a, b) => a.length - b.length)[0] ??
    parsed.map((p) => p.title).find((t) => t.length > 0) ??
    "";
  const artist =
    parsed
      .map((p) => searchArtist(p.title, p.artist))
      .find((a) => a.length > 0 && !looksLikeChannelName(a)) ??
    parsed.map((p) => searchArtist(p.title, p.artist)).find((a) => a.length > 0) ??
    "";
  return { candidateKey, title, artist, keys: [...keys], sourceLabel: sourceLabel(candidateKey) };
}

export function choiceGet(
  dict: Record<string, string>,
  title: string | null | undefined,
  artist: string | null | undefined,
): string | null {
  if (Object.keys(dict).length === 0) return null;
  const wantTitles = titleKeys(title);
  if (wantTitles.length === 0) return null;
  const wantArtists = artistKeys(artist, title);
  for (const t of wantTitles) {
    for (const a of wantArtists) {
      const exact = dict[`${a}|${t}`];
      if (exact) return exact;
    }
  }
  const hits = new Map<string, number>();
  for (const [key, value] of Object.entries(dict)) {
    const [storedArtist, storedTitle] = splitKey(key);
    if (!titlesOverlap(wantTitles, titleKeys(storedTitle), title, storedTitle)) continue;
    const na = normArtist(storedArtist);
    const artistHit = wantArtists.some((w) => w.length > 0 && na.length > 0 && artistsMatch(w, na));
    hits.set(value, (hits.get(value) ?? 0) + (artistHit ? 3 : 1));
  }
  if (hits.size === 0) return null;
  const best = [...hits.entries()].sort((a, b) => b[1] - a[1]);
  if (best.length === 1 || best[0][1] > best[1][1]) return best[0][0];
  return null;
}

export function choiceSet(
  dict: Record<string, string>,
  title: string | null | undefined,
  artist: string | null | undefined,
  candidateKey: string,
): Record<string, string> {
  const keys = allKeys(title, artist);
  if (keys.length === 0) return dict;
  const titles = titleKeys(title);
  const artists = artistKeys(artist, title);
  const next = { ...dict };
  for (const existing of Object.keys(next)) {
    if (keys.includes(existing)) continue;
    const [sa, st] = splitKey(existing);
    if (!titlesOverlap(titles, titleKeys(st), title, st)) continue;
    const na = normArtist(sa);
    const sameSong = na.length === 0 || artists.some((a) => a.length === 0 || artistsMatch(a, na));
    if (sameSong) delete next[existing];
  }
  for (const key of keys) next[key] = candidateKey;
  return next;
}

export function choiceRemove(dict: Record<string, string>, candidateKey: string): Record<string, string> {
  if (!candidateKey) return dict;
  const next = { ...dict };
  for (const [key, value] of Object.entries(dict)) {
    if (value === candidateKey) delete next[key];
  }
  return next;
}

export function choiceRetarget(
  dict: Record<string, string>,
  oldCandidate: string,
  newCandidate: string,
): Record<string, string> {
  if (!oldCandidate || !newCandidate || oldCandidate === newCandidate) return dict;
  const next = { ...dict };
  for (const [key, value] of Object.entries(next)) {
    if (value === oldCandidate) next[key] = newCandidate;
  }
  return next;
}

export function choiceList(dict: Record<string, string>): SavedChoice[] {
  const groups = new Map<string, string[]>();
  for (const [key, value] of Object.entries(dict)) {
    const list = groups.get(value) ?? [];
    list.push(key);
    groups.set(value, list);
  }
  return [...groups.entries()]
    .map(([candidate, keys]) => savedChoiceFrom(candidate, keys))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "accent" })
      || a.artist.localeCompare(b.artist, undefined, { sensitivity: "accent" }));
}
