import type { LyricCandidate } from "../core/candidate";
import type { LyricLine } from "../core/lyrics";
import {
  parseKugouLyric,
  parseKugouSearch,
  parseLrcLibLyric,
  parseLrcLibSearch,
  parseNeteaseLyric,
  parseNeteaseSearch,
  parseQqLyric,
  parseQqSearch,
} from "../core/providers";
import { collectCandidates, type LyricProvider } from "../core/search";

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const LRCLIB_UA = "DesktopLyric/0.1";

export type LyricCall = { url: string; method: string; headers: Record<string, string>; body?: string };

export type LyricResponse = { ok: boolean; status: number; body: string };

export type LyricFetch = (call: LyricCall) => Promise<LyricResponse>;

export function neteaseSearchCall(title: string, artist: string): LyricCall {
  const params = new URLSearchParams({
    s: `${title} ${artist}`.trim(),
    type: "1",
    limit: "20",
    offset: "0",
    total: "true",
  });
  return {
    url: "https://music.163.com/api/cloudsearch/pc",
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      referer: "https://music.163.com",
      "user-agent": BROWSER_UA,
    },
    body: params.toString(),
  };
}

export function neteaseLyricCall(id: string): LyricCall {
  return {
    url: `https://music.163.com/api/song/lyric?id=${encodeURIComponent(id)}&lv=1&tv=1&yv=1`,
    method: "GET",
    headers: { referer: "https://music.163.com", "user-agent": BROWSER_UA },
  };
}

export function qqSearchCall(title: string, artist: string): LyricCall {
  return qqCall("DoSearchForQQMusicDesktop", "music.search.SearchCgiService", {
    num_per_page: 20,
    page_num: 1,
    query: `${title} ${artist}`.replaceAll('"', "").trim(),
    search_type: 0,
  });
}

export function qqLyricCall(mid: string): LyricCall {
  return qqCall("GetPlayLyricInfo", "music.musichallSong.PlayLyricInfo", { songMID: mid, songID: 0 });
}

export function kugouSearchCall(title: string, artist: string): LyricCall {
  const keyword = encodeURIComponent(`${title} ${artist}`.trim());
  return {
    url: `http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=${keyword}&page=1&pagesize=20`,
    method: "GET",
    headers: { "user-agent": BROWSER_UA },
  };
}

export function kugouCandidateCall(hash: string, keyword: string): LyricCall {
  return {
    url: `https://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword=${encodeURIComponent(keyword)}&hash=${encodeURIComponent(hash)}`,
    method: "GET",
    headers: { "user-agent": BROWSER_UA },
  };
}

export function kugouDownloadCall(id: string, accessKey: string): LyricCall {
  return {
    url: `https://lyrics.kugou.com/download?ver=1&client=pc&id=${encodeURIComponent(id)}&accesskey=${encodeURIComponent(accessKey)}&fmt=lrc&charset=utf8`,
    method: "GET",
    headers: { "user-agent": BROWSER_UA },
  };
}

export function lrcLibSearchCall(title: string, artist: string): LyricCall {
  const params = new URLSearchParams({ track_name: title });
  if (artist.trim()) params.set("artist_name", artist.trim());
  return {
    url: `https://lrclib.net/api/search?${params.toString()}`,
    method: "GET",
    headers: { "user-agent": LRCLIB_UA },
  };
}

export function lrcLibGetCall(id: string): LyricCall {
  return {
    url: `https://lrclib.net/api/get/${encodeURIComponent(id)}`,
    method: "GET",
    headers: { "user-agent": LRCLIB_UA },
  };
}

export async function liveFetch(call: LyricCall): Promise<LyricResponse> {
  const response = await fetch(call.url, {
    method: call.method,
    headers: call.headers,
    body: call.body,
    signal: AbortSignal.timeout(8_000),
  });
  return { ok: response.ok, status: response.status, body: await response.text() };
}

export async function searchSources(title: string, artist: string, fetchImpl: LyricFetch): Promise<LyricCandidate[]> {
  if (!title.trim() && !artist.trim()) return [];
  return collectCandidates(providers(fetchImpl), title.trim(), artist.trim());
}

export async function fetchLyricByKey(
  key: string,
  keyword: string,
  fetchImpl: LyricFetch,
): Promise<LyricLine[] | null> {
  const split = key.indexOf(":");
  if (split <= 0) return null;
  const kind = key.slice(0, split);
  const id = key.slice(split + 1);
  if (!id) return null;
  if (kind === "ncm") return readJson(fetchImpl, neteaseLyricCall(id), parseNeteaseLyric);
  if (kind === "qq") return readJson(fetchImpl, qqLyricCall(id), parseQqLyric);
  if (kind === "lrc") return readJson(fetchImpl, lrcLibGetCall(id), parseLrcLibLyric);
  if (kind === "kg") return fetchKugouLyric(id, keyword.trim() || id, fetchImpl);
  return null;
}

function providers(fetchImpl: LyricFetch): LyricProvider[] {
  return [
    { search: (title, artist) => searchNetease(fetchImpl, title, artist) },
    { search: (title, artist) => searchQq(fetchImpl, title, artist) },
    { search: (title, artist) => searchKugou(fetchImpl, title, artist) },
    { search: (title, artist) => searchLrcLib(fetchImpl, title, artist) },
  ];
}

async function searchNetease(fetchImpl: LyricFetch, title: string, artist: string): Promise<LyricCandidate[]> {
  return (await readJson(fetchImpl, neteaseSearchCall(title, artist), parseNeteaseSearch)) ?? [];
}

async function searchQq(fetchImpl: LyricFetch, title: string, artist: string): Promise<LyricCandidate[]> {
  return (await readJson(fetchImpl, qqSearchCall(title, artist), parseQqSearch)) ?? [];
}

async function searchKugou(fetchImpl: LyricFetch, title: string, artist: string): Promise<LyricCandidate[]> {
  return (await readJson(fetchImpl, kugouSearchCall(title, artist), parseKugouSearch)) ?? [];
}

async function searchLrcLib(fetchImpl: LyricFetch, title: string, artist: string): Promise<LyricCandidate[]> {
  return (await readJson(fetchImpl, lrcLibSearchCall(title, artist), parseLrcLibSearch)) ?? [];
}

async function fetchKugouLyric(hash: string, keyword: string, fetchImpl: LyricFetch): Promise<LyricLine[] | null> {
  const listed = await readJson(fetchImpl, kugouCandidateCall(hash, keyword), (body: unknown) => {
    const candidates = (body as { candidates?: { id?: unknown; accesskey?: unknown }[] } | null)?.candidates;
    const first = candidates?.[0];
    if (!first) return null;
    const id = typeof first.id === "number" ? String(first.id) : first.id;
    const accessKey = first.accesskey;
    if (typeof id !== "string" || !id || typeof accessKey !== "string" || !accessKey) return null;
    return { id, accessKey };
  });
  if (!listed) return null;
  return readJson(fetchImpl, kugouDownloadCall(listed.id, listed.accessKey), parseKugouLyric);
}

async function readJson<T>(fetchImpl: LyricFetch, call: LyricCall, parse: (body: unknown) => T | null): Promise<T | null> {
  try {
    const response = await fetchImpl(call);
    if (!response.ok || !response.body) return null;
    return parse(JSON.parse(response.body) as unknown);
  } catch {
    return null;
  }
}

function qqCall(method: string, module: string, param: Record<string, unknown>): LyricCall {
  return {
    url: "https://u.y.qq.com/cgi-bin/musicu.fcg",
    method: "POST",
    headers: {
      "content-type": "application/json",
      referer: "https://y.qq.com",
      "user-agent": BROWSER_UA,
    },
    body: JSON.stringify({ comm: { ct: 19, cv: 1845 }, req: { method, module, param } }),
  };
}
