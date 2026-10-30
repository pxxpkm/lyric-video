import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseProject } from "../core/project";
import type { ImportSource, SavedSourceProject } from "../shared/import";
import { waitProjectWrites } from "./projectFile";
import { youtubeId } from "./mediaCache";

function urlKey(input: string): string {
  const id = youtubeId(input);
  if (id) return `youtube:${id}`;
  try { const url = new URL(input); url.hash = ""; return url.toString(); }
  catch { return input.trim(); }
}

function fileKey(input: string): string {
  const path = resolve(input);
  return process.platform === "win32" ? path.toLowerCase() : path;
}

export async function findSourceProjects(root: string, source: ImportSource): Promise<SavedSourceProject[]> {
  let folders;
  try { folders = await readdir(root, { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const result: SavedSourceProject[] = [];
  for (const folder of folders) {
    if (!folder.isDirectory() || folder.isSymbolicLink() || !/^(yt|file)-/.test(folder.name)) continue;
    const projectPath = join(root, folder.name, "project.json");
    await waitProjectWrites(projectPath);
    let project;
    try { project = parseProject(JSON.parse(await readFile(projectPath, "utf8"))); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EACCES" || (error as NodeJS.ErrnoException).code === "EPERM") throw error;
      continue;
    }
    const matches = source.kind === "youtube" ? project.source.kind === "youtube" && urlKey(project.source.url) === urlKey(source.url)
      : project.source.kind === "file" && fileKey(project.source.mediaPath) === fileKey(source.path);
    if (!matches) continue;
    let mediaAvailable = false;
    try { mediaAvailable = (await stat(project.source.mediaPath)).isFile(); } catch { /* 設定仍可找回，不因來源遺失而隱藏專案。 */ }
    result.push({ projectPath, durationMs: project.identity.durationMs, title: project.identity.title, artist: project.identity.artist, modified: (await stat(projectPath)).mtime.toISOString(), mode: project.source.mode,
      lyricCount: project.lyrics.lines.length, offsetMs: project.timing.offsetMs, fontSize: project.style.size, mediaAvailable });
  }
  return result.sort((a, b) => b.modified.localeCompare(a.modified) || a.projectPath.localeCompare(b.projectPath));
}
