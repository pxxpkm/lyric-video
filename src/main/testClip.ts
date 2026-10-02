import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { testClipLines, TEST_CLIP_MS } from "../core/preview";
import { projectFromImport } from "../core/importPlan";
import { parseProject, type Project } from "../core/project";
import { clampLook, type LyricLook } from "../core/lyricLook";
import type { MotionClip } from "../core/motion";
import { timingForProject } from "../core/projectTiming";
import { testToneWav } from "../core/testTone";
import type { TrackTiming } from "../core/timing";
import type { PreviewSession } from "../shared/preview";
import { saveProject } from "./projectFile";
import { studioRoot } from "./importService";

export function sessionFromProject(project: Project, projectPath: string): PreviewSession {
  return {
    title: project.identity.title,
    artist: project.identity.artist,
    mediaPath: project.source.mediaPath,
    projectPath,
    mode: project.source.mode,
    durationMs: project.identity.durationMs,
    lines: project.lyrics.lines.map((line) => ({
      atMs: line.atMs,
      text: line.text,
      trans: line.trans ?? "",
      words: line.words ?? [],
    })),
    timing: {
      offsetMs: project.timing.offsetMs,
      rate: project.timing.rate,
      lines: project.timing.lines,
      holds: project.timing.holds,
      texts: project.timing.texts,
      trans: project.timing.trans,
      added: project.timing.added.map((line) => ({
        atMs: line.atMs,
        text: line.text,
        id: line.id,
        ...(line.trans ? { trans: line.trans } : {}),
      })),
    },
    look: clampLook(project.style),
    motion: project.motion ?? [],
  };
}

export function loadPreview(projectPath: string): PreviewSession {
  const project = parseProject(JSON.parse(readFileSync(projectPath, "utf8")));
  return sessionFromProject(project, projectPath);
}

export async function savePreviewTiming(
  projectPath: string,
  timing: TrackTiming,
  look?: LyricLook,
  motion?: MotionClip[],
): Promise<void> {
  const project = parseProject(JSON.parse(readFileSync(projectPath, "utf8")));
  project.timing = timingForProject(timing);
  if (look) {
    const next = clampLook(look);
    project.style = { ...project.style, ...next };
  }
  if (motion) project.motion = motion;
  await saveProject(projectPath, project);
}

export async function createTestClip(): Promise<PreviewSession> {
  const folder = join(studioRoot(), "test-clip");
  await mkdir(folder, { recursive: true });
  const mediaPath = join(folder, "source.wav");
  const projectPath = join(folder, "project.json");
  if (existsSync(projectPath) && existsSync(mediaPath)) return loadPreview(projectPath);
  if (!existsSync(mediaPath)) await writeFile(mediaPath, testToneWav());
  const lines = testClipLines();
  const project = projectFromImport({
    kind: "file",
    url: "",
    mediaPath,
    title: "測試片",
    artist: "",
    durationMs: TEST_CLIP_MS,
    mode: "audio",
    lockTitle: false,
    lockArtist: false,
  });
  project.lyrics.lines = lines.map((line) => ({
    atMs: line.timeMs,
    text: line.text,
    trans: line.translatedText ?? "",
    words: (line.words ?? []).map((word) => ({
      startMs: word.startMs,
      durMs: word.durMs,
      text: word.text,
    })),
  }));
  await saveProject(projectPath, project);
  return sessionFromProject(project, projectPath);
}
