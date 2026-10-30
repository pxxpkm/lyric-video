import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { CacheEntry } from "../shared/cache";
import { RECEIPT } from "./downloadReceipt";
import { parseProject } from "../core/project";
import { waitProjectWrites } from "./projectFile";

export async function listCache(root: string): Promise<CacheEntry[]> {
  let folders;
  try { folders = await readdir(root, { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const refs = new Map<string, string[]>();
  const projectLinks = new Map<string, CacheEntry["projectLinks"]>();
  const legacySources = new Set<string>();
  for (const folder of folders.filter((entry) => entry.isDirectory())) {
    try {
      const projectPath = join(root, folder.name, "project.json");
      await waitProjectWrites(projectPath);
      const project = JSON.parse(await readFile(projectPath, "utf8"));
      if (typeof project.source?.mediaPath !== "string") continue;
      const key = resolve(project.source.mediaPath).toLowerCase();
      const label = `${project.identity?.title || folder.name}（${folder.name}）`;
      refs.set(key, [...(refs.get(key) ?? []), label]);
      try {
        parseProject(project);
        projectLinks.set(key, [...(projectLinks.get(key) ?? []), { projectPath, label }]);
      } catch { /* 壞專案仍列引用名稱，但不提供可編輯連結。 */ }
      if (project.source.kind === "youtube" && /^https?:\/\//i.test(project.source.url ?? "") &&
        dirname(key) === resolve(root, folder.name).toLowerCase()) legacySources.add(key);
    } catch { /* 未完成或失效專案不作引用記錄。 */ }
  }
  const result: CacheEntry[] = [];
  for (const folder of folders.filter((entry) => entry.isDirectory() && entry.name.startsWith("yt-"))) {
    const dir = join(root, folder.name);
    if (resolve(await realpath(dir)).toLowerCase() !== resolve(dir).toLowerCase()) continue;
    let receipt: { name: string; bytes: number; modifiedMs: number }[] = [];
    let hasReceipt = true;
    try {
      const data = JSON.parse(await readFile(join(dir, RECEIPT), "utf8"));
      if (data.version === 1 && Array.isArray(data.files)) receipt = data.files;
    } catch (error) { hasReceipt = (error as NodeJS.ErrnoException).code !== "ENOENT"; }
    for (const file of await readdir(dir, { withFileTypes: true })) {
      if (!file.isFile() || !/^source\./i.test(file.name)) continue;
      const path = join(dir, file.name);
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink()) continue;
      const recorded = receipt.some((entry) => entry?.name === file.name && entry.bytes === info.size && entry.modifiedMs === info.mtimeMs);
      const legacy = !hasReceipt && /^source\.(mp4|webm|mkv|mov|m4a|mp3|ogg|opus|wav|flac|aac)$/i.test(file.name) && legacySources.has(resolve(path).toLowerCase());
      const clearable = recorded || legacy;
      result.push({ path, name: `${folder.name}/${file.name}`, bytes: info.size, modified: info.mtime.toISOString(), projects: refs.get(resolve(path).toLowerCase()) ?? [], projectLinks: projectLinks.get(resolve(path).toLowerCase()) ?? [], clearable, reason: clearable ? "" : "未能確認為下載素材，或檔案已變更；保留不清除。" });
    }
  }
  return result.sort((a, b) => b.modified.localeCompare(a.modified));
}

export async function cacheEntry(root: string, path: string): Promise<CacheEntry | null> {
  const entry = (await listCache(root)).find((item) => item.path === path);
  if (!entry?.clearable) return null;
  const actualRoot = await realpath(root);
  const actual = await realpath(path);
  if (dirname(dirname(actual)).toLowerCase() !== actualRoot.toLowerCase()) return null;
  return entry;
}

export async function trashCacheEntries(
  root: string,
  entries: CacheEntry[],
  trash: (path: string) => Promise<void>,
  canContinue: () => boolean,
): Promise<{ cleared: number; failed: string[] }> {
  let cleared = 0;
  const failed: string[] = [];
  for (const entry of entries) {
    try {
      const current = canContinue() ? await cacheEntry(root, entry.path) : null;
      if (!current || current.bytes !== entry.bytes || current.modified !== entry.modified) {
        failed.push(entry.name);
        continue;
      }
      await trash(entry.path);
      cleared++;
    } catch { failed.push(entry.name); }
  }
  return { cleared, failed };
}
