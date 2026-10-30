import { readFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { parseProject } from "../core/project";
import { downloadUrl, probeFile } from "./media";
import { findCachedMedia, youtubeId } from "./mediaCache";
import { studioRoot } from "./paths";
import { updateProject, waitProjectWrites } from "./projectFile";
import { throwIfToolCancelled } from "./toolOperations";

type SourceMedia = { mediaPath: string };
const repairs = new Map<string, Promise<void>>();
const sources = new Map<string, Promise<SourceMedia>>();
export const mediaRecoveryBusy = () => repairs.size > 0;

async function available(path: string): Promise<boolean> {
  if (!path) return false;
  try { const file = await stat(path); return file.isFile() && file.size > 0; }
  catch (error) {
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return false;
    throw new Error("未能讀取來源素材，請檢查檔案權限後再試。沒有重設專案。");
  }
}

async function recoverSource(url: string, mode: "video" | "audio", progress: (text: string) => void): Promise<SourceMedia> {
  const key = `${youtubeId(url) ?? url.trim()}|${mode}`;
  const existing = sources.get(key);
  if (existing) {
    progress("正在等候同一來源素材補回");
    const media = await existing;
    if (await available(media.mediaPath)) return media;
    if (sources.get(key) !== existing) return recoverSource(url, mode, progress);
    sources.delete(key);
  }
  const pending = (async () => {
    progress("來源素材已遺失，正在尋找可重用的本機副本");
    const cached = await findCachedMedia(studioRoot(), url, mode, probeFile);
    throwIfToolCancelled();
    if (cached) return cached;
    progress("正在重新下載來源素材，專案設定會保留");
    const directory = join(studioRoot(), `yt-recovered-${randomUUID()}`);
    const downloaded = await downloadUrl(url, directory, mode, (percent) => progress(`正在補回來源素材 ${Math.floor(percent)}%`));
    if (!downloaded.ok) throw new Error(`未能補回來源素材：${downloaded.error} 原專案設定仍然保留。`);
    const duration = await probeFile(downloaded.mediaPath);
    throwIfToolCancelled();
    if (!await available(downloaded.mediaPath) || duration == null || !Number.isFinite(duration) || duration <= 0) throw new Error("下載的來源素材未能讀取，沒有更改專案設定。請稍後再試。");
    return downloaded;
  })();
  sources.set(key, pending);
  try { return await pending; }
  catch (error) { if (sources.get(key) === pending) sources.delete(key); throw error; }
}

export function ensureProjectMedia(projectPath: string, progress: (text: string) => void = () => {}): Promise<void> {
  const key = resolve(projectPath).toLowerCase();
  const previous = repairs.get(key);
  if (previous) return previous;
  const pending = (async () => {
    await waitProjectWrites(projectPath);
    const project = parseProject(JSON.parse(await readFile(projectPath, "utf8")));
    if (await available(project.source.mediaPath)) return;
    if (project.source.kind !== "youtube") throw new Error("本機來源檔已被刪除或移走。請先從資源回收筒還原到原本位置，再開啟這份專案；原有設定仍保留。");
    if (!/^https?:\/\//i.test(project.source.url)) throw new Error("專案沒有可用的來源連結，未能自動補回素材；原有設定仍保留。");
    const media = await recoverSource(project.source.url, project.source.mode, progress);
    throwIfToolCancelled();
    await updateProject(projectPath, async (latest) => {
      throwIfToolCancelled();
      if (latest.source.kind !== project.source.kind || latest.source.url !== project.source.url || latest.source.mode !== project.source.mode) throw new Error("專案來源已變更，請重新開啟。沒有重設編輯內容。");
      // 只補來源路徑；下載期間的新編輯及已有人手設定一律保留。
      if (!await available(latest.source.mediaPath)) latest.source.mediaPath = media.mediaPath;
      return latest;
    });
    progress("來源素材已補回，正在開啟原專案");
  })();
  repairs.set(key, pending);
  const cleanup = () => { if (repairs.get(key) === pending) repairs.delete(key); };
  void pending.then(cleanup, cleanup);
  return pending;
}
