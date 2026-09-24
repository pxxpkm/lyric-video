import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { testClipLines, TEST_CLIP_MS } from "../core/preview";
import { projectFromImport } from "../core/importPlan";
import { testToneWav } from "../core/testTone";
import type { PreviewSession } from "../shared/preview";
import { saveProject } from "./projectFile";
import { studioRoot } from "./importService";

export async function createTestClip(): Promise<PreviewSession> {
  const folder = join(studioRoot(), "test-clip");
  await mkdir(folder, { recursive: true });
  const mediaPath = join(folder, "source.wav");
  await writeFile(mediaPath, testToneWav());
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
  const projectPath = join(folder, "project.json");
  await saveProject(projectPath, project);
  return {
    title: "測試片",
    artist: "",
    mediaPath,
    mode: "audio",
    durationMs: TEST_CLIP_MS,
    lines: project.lyrics.lines,
  };
}
