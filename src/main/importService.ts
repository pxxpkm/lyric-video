import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { planImport, projectFromImport, titleFromFileName } from "../core/importPlan";
import { saveProject } from "./projectFile";
import { downloadUrl, IMPORT_FAIL, probeFile, probeUrl } from "./media";
import type { ProbeResult, SaveRequest, SaveResult } from "../shared/import";

export function studioRoot(): string {
  return join(process.cwd(), "studio-data");
}

function projectDir(seed: string): string {
  const safe = seed.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "track";
  return join(studioRoot(), `${safe}-${randomBytes(3).toString("hex")}`);
}

function locksOf(input: { lockTitle: boolean; lockArtist: boolean; title: string; artist: string }) {
  return {
    lockTitle: input.lockTitle,
    lockArtist: input.lockArtist,
    title: input.title,
    artist: input.artist,
  };
}

export async function describeUrl(
  url: string,
  fields: { lockTitle: boolean; lockArtist: boolean; title: string; artist: string },
): Promise<ProbeResult> {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return { ok: false, error: "請貼上 http 連結，或改拖本機檔。" };
  const probed = await probeUrl(trimmed);
  if (!probed.ok) return probed;
  return {
    ok: true,
    draft: planImport(
      { rawTitle: probed.title, rawArtist: probed.uploader, durationMs: probed.durationMs },
      locksOf(fields),
    ),
  };
}

export async function describeFile(
  filePath: string,
  fields: { lockTitle: boolean; lockArtist: boolean; title: string; artist: string },
): Promise<ProbeResult> {
  if (!filePath || !existsSync(filePath)) return { ok: false, error: "找不到這個檔，請改拖本機檔。" };
  const durationMs = await probeFile(filePath);
  return {
    ok: true,
    draft: planImport(
      { rawTitle: titleFromFileName(filePath), rawArtist: "", durationMs },
      locksOf(fields),
    ),
  };
}

export async function saveDownloaded(
  url: string,
  request: SaveRequest,
  onPercent?: (percent: number) => void,
): Promise<SaveResult> {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return { ok: false, error: "請貼上 http 連結，或改拖本機檔。" };
  const folder = projectDir("yt");
  const downloaded = await downloadUrl(trimmed, folder, request.mode, onPercent);
  if (!downloaded.ok) return downloaded;
  const durationMs = (await probeFile(downloaded.mediaPath)) ?? request.durationMs;
  const projectPath = join(folder, "project.json");
  await saveProject(
    projectPath,
    projectFromImport({
      kind: "youtube",
      url: trimmed,
      mediaPath: downloaded.mediaPath,
      ...request,
      durationMs,
    }),
  );
  return { ok: true, projectPath, mediaPath: downloaded.mediaPath };
}

export async function saveLocal(filePath: string, request: SaveRequest): Promise<SaveResult> {
  if (!filePath || !existsSync(filePath)) return { ok: false, error: "找不到這個檔，請改拖本機檔。" };
  const folder = projectDir("file");
  await mkdir(folder, { recursive: true });
  const durationMs = (await probeFile(filePath)) ?? request.durationMs;
  const projectPath = join(folder, "project.json");
  await saveProject(
    projectPath,
    projectFromImport({
      kind: "file",
      url: "",
      mediaPath: filePath,
      ...request,
      durationMs,
    }),
  );
  return { ok: true, projectPath, mediaPath: filePath };
}

export { IMPORT_FAIL };
