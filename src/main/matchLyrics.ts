import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { LyricLine } from "../core/lyrics";
import { applyLyricsToProject, lyricHits } from "../core/lyricMatch";
import { parseProject, type Project } from "../core/project";
import { decide, type Decision } from "../core/score";
import type { MatchResult, PickList } from "../shared/pick";
import { ChoiceStore } from "./choiceStore";
import { logDir } from "./log";
import { fetchLyricByKey, liveFetch, searchSources, type LyricFetch } from "./lyricRemote";
import { saveProject } from "./projectFile";
import { loadPreview } from "./testClip";

const pending = new Map<string, PickList>();

type MatchDeps = { fetch?: LyricFetch; choices?: ChoiceStore };

export function isTestClipProject(projectPath: string): boolean {
  return basename(dirname(projectPath)).toLowerCase() === "test-clip";
}

export async function matchProject(projectPath: string, deps?: MatchDeps): Promise<MatchResult> {
  const current = loadPreview(projectPath);
  if (isTestClipProject(projectPath)) return { kind: "preview", session: current };
  try {
    const project = readProject(projectPath);
    const found = await lookup(project, deps);
    pending.set(projectPath, found.pick);
    if (!found.lines || !found.chosen) return { kind: "pick", session: current, pick: found.pick };
    await saveProject(projectPath, applyLyricsToProject(project, found.lines, found.chosen));
    return { kind: "preview", session: loadPreview(projectPath) };
  } catch {
    const pick: PickList = {
      title: current.title,
      artist: current.artist,
      durationMs: current.durationMs,
      reason: "搜尋失敗",
      hits: [],
    };
    pending.set(projectPath, pick);
    return { kind: "pick", session: current, pick };
  }
}

export async function browseProject(
  projectPath: string,
  fields: { title: string; artist: string; lockTitle: boolean; lockArtist: boolean } | null,
  deps?: MatchDeps,
): Promise<MatchResult> {
  const current = loadPreview(projectPath);
  if (isTestClipProject(projectPath)) return { kind: "preview", session: current };
  const project = readProject(projectPath);
  if (fields) {
    project.identity = {
      ...project.identity,
      title: fields.title,
      artist: fields.artist,
      lockTitle: fields.lockTitle,
      lockArtist: fields.lockArtist,
    };
    await saveProject(projectPath, project);
  }
  const found = await lookup(project, deps, true);
  pending.set(projectPath, found.pick);
  return { kind: "pick", session: loadPreview(projectPath), pick: found.pick };
}

export async function useCandidate(
  projectPath: string,
  key: string,
  remember: boolean,
  deps?: MatchDeps,
): Promise<MatchResult | { ok: false; error: string }> {
  if (isTestClipProject(projectPath)) return { kind: "preview", session: loadPreview(projectPath) };
  const list = pending.get(projectPath);
  const hit = list?.hits.find((item) => item.key === key);
  if (!list || !hit) return { ok: false, error: "請再搜一次" };
  const lines = await fetchLyricByKey(hit.key, keyword(list.title, list.artist), fetchOf(deps));
  if (!lines || lines.length === 0) return { ok: false, error: "抓不到這份歌詞" };
  const project = readProject(projectPath);
  await saveProject(
    projectPath,
    applyLyricsToProject(project, lines, {
      key: hit.key,
      source: hit.source,
      score: hit.score,
      autoAccepted: false,
      reason: "人手揀",
    }),
  );
  if (remember) choicesOf(deps).set(list.title, list.artist, hit.key);
  return { kind: "preview", session: loadPreview(projectPath) };
}

async function lookup(
  project: Project,
  deps?: MatchDeps,
  listOnly = false,
): Promise<{ pick: PickList; lines: LyricLine[] | null; chosen: { key: string; source: string; score: number; autoAccepted: boolean; reason: string } | null }> {
  const title = project.identity.title;
  const artist = project.identity.artist;
  const durationMs = project.identity.durationMs > 0 ? project.identity.durationMs : null;
  const candidates = await searchSources(title, artist, fetchOf(deps));
  const rememberedKey = choicesOf(deps).get(title, artist);
  let decision = decide({ title, artist, durationMs, candidates, rememberedKey });
  if (!listOnly && decision.accept && decision.candidate && decision.reason === "已記住") {
    const lines = await fetchLyricByKey(decision.candidate.key, keyword(title, artist), fetchOf(deps));
    if (lines && lines.length > 0) return packed(durationMs, title, artist, decision, lines, true);
    decision = decide({ title, artist, durationMs, candidates });
  }
  if (!listOnly && decision.accept && decision.candidate) {
    const lines = await fetchLyricByKey(decision.candidate.key, keyword(title, artist), fetchOf(deps));
    if (lines && lines.length > 0) return packed(durationMs, title, artist, decision, lines, true);
    return packed(durationMs, title, artist, decision, null, false, "抓不到歌詞");
  }
  return packed(durationMs, title, artist, decision, null, false);
}

function packed(
  durationMs: number | null,
  title: string,
  artist: string,
  decision: Decision,
  lines: LyricLine[] | null,
  auto: boolean,
  reason = decision.reason,
): {
  pick: PickList;
  lines: LyricLine[] | null;
  chosen: { key: string; source: string; score: number; autoAccepted: boolean; reason: string } | null;
} {
  const hits = lyricHits(decision.ranked, durationMs);
  const candidate = decision.candidate;
  const ranked = decision.ranked.find((item) => item.candidate.key === candidate?.key);
  return {
    pick: { title, artist, durationMs: durationMs ?? 0, reason, hits },
    lines: auto ? lines : null,
    chosen:
      auto && candidate
        ? {
            key: candidate.key,
            source: candidate.source,
            score: ranked?.score ?? 0,
            autoAccepted: true,
            reason,
          }
        : null,
  };
}

function keyword(title: string, artist: string): string {
  return `${title} ${artist}`.trim();
}

function readProject(projectPath: string): Project {
  return parseProject(JSON.parse(readFileSync(projectPath, "utf8")) as unknown);
}

function fetchOf(deps?: MatchDeps): LyricFetch {
  return deps?.fetch ?? liveFetch;
}

function choicesOf(deps?: MatchDeps): ChoiceStore {
  return deps?.choices ?? defaultChoices();
}

let stored: ChoiceStore | null = null;

function defaultChoices(): ChoiceStore {
  stored ??= new ChoiceStore(join(logDir(), "choices.json"));
  return stored;
}
