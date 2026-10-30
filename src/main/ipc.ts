import { BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from "electron";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { assFileName, mp4FileName } from "../core/exportName";
import { exportProject, saveAssFile, type ExportRequest } from "./exportVideo";
import { resourceRoot } from "./paths";
import { browseProject, matchProject, resumeProject, useCandidate } from "./matchLyrics";
import { cancelJob, retryJob, enqueueFile, enqueueTest, enqueueUrls, listJobs, openJob } from "./queue";
import { readSettings, writeSettings } from "./settings";
import { describeFile, describeUrl, saveDownloaded, saveLocal } from "./importService";
import { IMPORT_FAIL } from "./media";
import { studioRoot } from "./paths";
import { cacheEntry, listCache, trashCacheEntries } from "./cacheLibrary";
import { createTestClip, loadPreview, savePreviewTiming } from "./testClip";
import { clampLook, type LyricLook } from "../core/lyricLook";
import type { MotionClip } from "../core/motion";
import { timingFromProject } from "../core/projectTiming";
import type { StoredTiming } from "../shared/preview";
import type { SaveRequest } from "../shared/import";
import { waitProjectWrites } from "./projectFile";
import { findSourceProjects } from "./sourceProjects";
import { ensureProjectMedia, mediaRecoveryBusy } from "./projectMedia";
import { runToolOperation, cancelToolOperation, toolOperationsBusy, throwIfToolCancelled } from "./toolOperations";
import { cookieStatus, importCookieFile, clearCookieFile } from "./cookieFile";

let exportBusy = false;

async function foreground<T>(event: IpcMainInvokeEvent, kind: "import" | "export", task: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  const key = `foreground:${event.sender.id}:${kind}`;
  const cancel = () => { cancelToolOperation(key); };
  const notify = (active: boolean) => { if (!event.sender.isDestroyed()) event.sender.send("tool:state", { kind, active }); };
  try {
    return await runToolOperation(key, async () => {
      event.sender.once("destroyed", cancel);
      notify(true);
      try { return await task(); }
      finally { event.sender.removeListener("destroyed", cancel); notify(false); }
    });
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "工具工作失敗，請重試。" }; }
}

function searchFields(value: unknown): { lockTitle: boolean; lockArtist: boolean; title: string; artist: string } | null {
  if (value == null) return null;
  return fields(value);
}

function fields(value: unknown): { lockTitle: boolean; lockArtist: boolean; title: string; artist: string } {
  const row = value != null && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    lockTitle: row.lockTitle === true,
    lockArtist: row.lockArtist === true,
    title: typeof row.title === "string" ? row.title : "",
    artist: typeof row.artist === "string" ? row.artist : "",
  };
}

function request(value: unknown): SaveRequest | null {
  const row = value != null && typeof value === "object" ? (value as Record<string, unknown>) : null;
  if (!row) return null;
  if (row.mode !== "video" && row.mode !== "audio") return null;
  if (typeof row.title !== "string" || typeof row.artist !== "string") return null;
  const durationMs = typeof row.durationMs === "number" && Number.isFinite(row.durationMs) ? row.durationMs : 0;
  return {
    title: row.title,
    artist: row.artist,
    durationMs,
    mode: row.mode,
    lockTitle: row.lockTitle === true,
    lockArtist: row.lockArtist === true,
  };
}

function exportRequest(value: unknown): ExportRequest | null {
  const row = value != null && typeof value === "object" ? (value as Record<string, unknown>) : null;
  if (!row) return null;
  if (typeof row.projectPath !== "string" || typeof row.mediaPath !== "string") return null;
  if (row.mode !== "video" && row.mode !== "audio") return null;
  if (!Array.isArray(row.lines) || row.timing == null || typeof row.timing !== "object") return null;
  const durationMs = typeof row.durationMs === "number" && Number.isFinite(row.durationMs) ? row.durationMs : 0;
  return {
    projectPath: row.projectPath,
    mediaPath: row.mediaPath,
    mode: row.mode,
    durationMs,
    lines: row.lines as ExportRequest["lines"],
    timing: row.timing as ExportRequest["timing"],
    look: row.look != null && typeof row.look === "object" ? clampLook(row.look as Partial<LyricLook>) : undefined,
    title: typeof row.title === "string" ? row.title : "",
    outPath: "",
    motion: Array.isArray(row.motion) ? (row.motion as ExportRequest["motion"]) : [],
    textMeasurements: Array.isArray(row.textMeasurements) ? row.textMeasurements.filter((item): item is import("../core/textWidth").TextMeasurement =>
      item != null && typeof item === "object" && typeof item.font === "string" && typeof item.text === "string" && typeof item.em === "number" && Number.isFinite(item.em) && item.em > 0,
    ) : undefined,
  };
}

export function registerImportIpc(): void {
  const cookieBusy = () => toolOperationsBusy() || mediaRecoveryBusy() || listJobs().some(job => job.status === "waiting" || job.status === "running");
  ipcMain.handle("cookies:status", () => cookieStatus());
  ipcMain.handle("cookies:select", async (event) => {
    if (cookieBusy()) return { ok: false, error: "請等讀取、下載及匯出停止後再更改 Cookies。" };
    const win = BrowserWindow.fromWebContents(event.sender);
    const options = { title: "選擇 Netscape Cookies 檔", filters: [{ name: "Cookies 文字檔", extensions: ["txt"] }], properties: ["openFile"] as ["openFile"] };
    const picked = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    if (picked.canceled || !picked.filePaths[0]) return { ok: false, cancelled: true };
    if (cookieBusy()) return { ok: false, error: "有工具工作正在處理，請停止後再更改 Cookies。" };
    try { return { ok: true, status: await importCookieFile(picked.filePaths[0]) }; }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : "未能匯入 Cookies，原有設定已保留。" }; }
  });
  ipcMain.handle("cookies:clear", async (event) => {
    if (cookieBusy()) return { ok: false, error: "請等讀取、下載及匯出停止後再清除 Cookies。" };
    const win = BrowserWindow.fromWebContents(event.sender);
    const options = { type: "question" as const, title: "清除程式的 Cookies", message: "清除程式保存的 Cookies 副本？", detail: "只清除本程式資料目錄的副本，不會刪除你原本匯出的檔案，亦不會登出瀏覽器。", buttons: ["取消", "清除副本"], defaultId: 0, cancelId: 0 };
    const answer = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
    if (answer.response !== 1) return { ok: false, cancelled: true };
    if (cookieBusy()) return { ok: false, error: "有工具工作正在處理，請停止後再清除 Cookies。" };
    try { return { ok: true, status: await clearCookieFile() }; }
    catch { return { ok: false, error: "未能清除程式的 Cookies，請稍後再試。" }; }
  });
  ipcMain.handle("tool:cancel", (event, kind: unknown) => {
    if (kind !== "import" && kind !== "export") return false;
    return cancelToolOperation(`foreground:${event.sender.id}:${kind}`);
  });
  ipcMain.handle("import:find-projects", (_event, source: unknown) => {
    if (!source || typeof source !== "object") throw new Error("沒有來源");
    const row = source as Record<string, unknown>;
    if (row.kind === "youtube" && typeof row.url === "string") return findSourceProjects(studioRoot(), { kind: "youtube", url: row.url });
    if (row.kind === "file" && typeof row.path === "string") return findSourceProjects(studioRoot(), { kind: "file", path: row.path });
    throw new Error("沒有來源");
  });
  ipcMain.handle("preview:resume", (event, projectPath: unknown) => foreground(event, "import", async () => {
    if (typeof projectPath !== "string") throw new Error("沒有專案");
    try {
      await ensureProjectMedia(projectPath, (text) => event.sender.send("import:progress", text));
      throwIfToolCancelled();
      return await resumeProject(projectPath);
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "未能讀取來源素材，原專案設定仍保留。" }; }
  }));
  ipcMain.handle("cache:trash-all", async () => {
    const idle = () => !exportBusy && !mediaRecoveryBusy() && !toolOperationsBusy() && !listJobs().some((job) => job.status === "running" || job.status === "waiting");
    if (!idle()) return "請等下載及匯出完成後再清除。";
    const entries = (await listCache(studioRoot())).filter((entry) => entry.clearable);
    if (!entries.length) return "沒有可安全清除的下載素材；未確認檔案會保留。";
    const projects = [...new Set(entries.flatMap((entry) => entry.projects))];
    const megabytes = (entries.reduce((sum, entry) => sum + entry.bytes, 0) / 1024 / 1024).toFixed(1);
    const answer = await dialog.showMessageBox({
      type: "warning", title: "全部清除下載素材",
      message: `將全部 ${entries.length} 個下載素材（${megabytes} MB）移至資源回收筒？`,
      detail: `引用素材的專案將無法播放或匯出；專案設定會保留。YouTube 專案下次編輯會先找本機副本，冇先重新下載並接回原專案。\n\n引用專案：\n${projects.join("\n") || "未找到引用專案"}`,
      buttons: ["取消", "全部移至資源回收筒"], defaultId: 0, cancelId: 0,
    });
    if (answer.response !== 1) return "";
    const result = await trashCacheEntries(studioRoot(), entries, (path) => shell.trashItem(path), idle);
    return `已清除 ${result.cleared} 個素材。${result.failed.length ? `未清除 ${result.failed.length} 個：\n${result.failed.join("\n")}\n檔案可能正被使用或有工作處理中，請稍後再試。` : ""}`;
  });
  ipcMain.handle("cache:list", () => listCache(studioRoot()));
  ipcMain.handle("cache:trash", async (_event, path: unknown) => {
    if (typeof path !== "string") return "無效素材";
    if (exportBusy || mediaRecoveryBusy() || toolOperationsBusy() || listJobs().some((job) => job.status === "running" || job.status === "waiting")) return "請等素材補回、下載及匯出完成後再清除。";
    const entry = await cacheEntry(studioRoot(), path);
    if (!entry) return "素材已不存在，請重新整理。";
    const answer = await dialog.showMessageBox({ type: "warning", title: "清除下載素材", message: `將 ${entry.name} 移至資源回收筒？`, detail: `引用此檔的專案將無法播放或匯出；專案設定會保留。YouTube 專案下次編輯會先找本機副本，冇先重新下載並接回原專案。\n\n引用專案：\n${entry.projects.join("\n") || "未找到引用專案（可能是未完成下載）"}`, buttons: ["取消", "移至資源回收筒"], defaultId: 0, cancelId: 0 });
    if (answer.response !== 1) return "";
    if (exportBusy || mediaRecoveryBusy() || toolOperationsBusy() || listJobs().some((job) => job.status === "running" || job.status === "waiting")) return "有工作處理中，請稍後再試。";
    const current = await cacheEntry(studioRoot(), path);
    if (!current || current.bytes !== entry.bytes || current.modified !== entry.modified) return "素材已變更，請重新整理。";
    try { await shell.trashItem(path); return ""; } catch { return "未能移至資源回收筒，檔案可能正被使用。"; }
  });
  ipcMain.handle("import:probe-url", (event, url: unknown, current: unknown) => foreground(event, "import", async () => {
    if (typeof url !== "string") return { ok: false, error: IMPORT_FAIL };
    return describeUrl(url, fields(current));
  }));

  ipcMain.handle("import:probe-file", (event, filePath: unknown, current: unknown) => foreground(event, "import", async () => {
    if (typeof filePath !== "string") return { ok: false, error: IMPORT_FAIL };
    return describeFile(filePath, fields(current));
  }));

  ipcMain.handle("import:download-url", (event: IpcMainInvokeEvent, url: unknown, body: unknown) => foreground(event, "import", async () => {
    const parsed = request(body);
    if (typeof url !== "string" || !parsed) return { ok: false, error: IMPORT_FAIL };
    let lastSent = 0;
    return saveDownloaded(url, parsed, (percent) => {
      const now = Date.now();
      if (now - lastSent < 200) return;
      lastSent = now;
      event.sender.send("import:progress", `正在下載 ${Math.floor(percent)}%`);
    });
  }));

  ipcMain.handle("preview:test-clip", () => createTestClip());
  ipcMain.handle("preview:load", async (_event, projectPath: unknown) => {
    if (typeof projectPath !== "string") throw new Error("沒有專案");
    await waitProjectWrites(projectPath);
    await ensureProjectMedia(projectPath);
    return loadPreview(projectPath);
  });
  ipcMain.handle("export:video", (event: IpcMainInvokeEvent, body: unknown) => foreground(event, "export", async () => {
    const request = exportRequest(body);
    if (!request) return { ok: false, error: "沒有可匯出的歌詞" };
    if (request.lines.length === 0) return { ok: false, error: "沒有可匯出的歌詞" };
    let last = 0;
    if (exportBusy) return { ok: false, error: "另一條正在匯出" };
    const win = BrowserWindow.fromWebContents(event.sender);
    const dialogOptions = {
      title: "匯出 MP4",
      defaultPath: join(dirname(request.projectPath), mp4FileName(request.title)),
      filters: [{ name: "MP4", extensions: ["mp4"] }],
    };
    const picked = win ? await dialog.showSaveDialog(win, dialogOptions) : await dialog.showSaveDialog(dialogOptions);
    if (picked.canceled || !picked.filePath) return { ok: false, cancelled: true };
    request.outPath = picked.filePath.toLowerCase().endsWith(".mp4") ? picked.filePath : `${picked.filePath}.mp4`;
    exportBusy = true;
    try {
      const result = await exportProject(request, join(resourceRoot(), "fonts"), (text) => {
        const now = Date.now();
        if (now - last < 200 && !text.startsWith("匯出")) return;
        last = now;
        event.sender.send("export:progress", text);
      });
      if (result.ok) await shell.openPath(result.outPath);
      return result;
    } finally {
      exportBusy = false;
    }
  }));
  ipcMain.handle("export:ass", async (event: IpcMainInvokeEvent, body: unknown) => {
    const request = exportRequest(body);
    if (!request) return { ok: false, error: "沒有可匯出的歌詞" };
    if (request.lines.length === 0) return { ok: false, error: "沒有可匯出的歌詞" };
    if (exportBusy) return { ok: false, error: "另一條正在匯出" };
    const win = BrowserWindow.fromWebContents(event.sender);
    const dialogOptions = {
      title: "輸出 ASS",
      defaultPath: join(dirname(request.projectPath), assFileName(request.title)),
      filters: [{ name: "ASS", extensions: ["ass"] }],
    };
    const picked = win ? await dialog.showSaveDialog(win, dialogOptions) : await dialog.showSaveDialog(dialogOptions);
    if (picked.canceled || !picked.filePath) return { ok: false, cancelled: true };
    exportBusy = true;
    try {
      return await saveAssFile(picked.filePath, request);
    } finally {
      exportBusy = false;
    }
  });

  ipcMain.handle("settings:get", () => readSettings());
  ipcMain.handle("settings:set", (_event, showTrans: unknown) => writeSettings({ showTrans: showTrans !== false }));
  ipcMain.handle("queue:list", () => listJobs());
  ipcMain.handle("queue:cancel", (_event, id: unknown) => { if (typeof id === "string") cancelJob(id); return listJobs(); });
  ipcMain.handle("queue:retry", (_event, id: unknown) => { if (typeof id === "string") retryJob(id); return listJobs(); });
  ipcMain.handle("queue:urls", (_event, text: unknown) => {
    if (typeof text === "string") enqueueUrls(text);
    return listJobs();
  });
  ipcMain.handle("queue:file", (_event, filePath: unknown) => {
    if (typeof filePath === "string") enqueueFile(filePath);
    return listJobs();
  });
  ipcMain.handle("queue:test", () => enqueueTest());
  ipcMain.handle("queue:open", (event, id: unknown) => foreground(event, "import", async () => {
    if (typeof id !== "string") return null;
    return openJob(id, (text) => event.sender.send("import:progress", text));
  }));
  ipcMain.handle("lyric:match", async (event, projectPath: unknown) => {
    if (typeof projectPath !== "string") return { ok: false, error: "沒有專案" };
    event.sender.send("import:progress", "正在搜尋歌詞");
    try {
      return await matchProject(projectPath);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "搜尋失敗" };
    }
  });
  ipcMain.handle("lyric:browse", async (event, projectPath: unknown, fields: unknown) => {
    if (typeof projectPath !== "string") return { ok: false, error: "沒有專案" };
    event.sender.send("import:progress", "正在搜尋歌詞");
    try {
      return await browseProject(projectPath, searchFields(fields));
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "搜尋失敗" };
    }
  });
  ipcMain.handle("lyric:use", async (_event, projectPath: unknown, key: unknown, remember: unknown) => {
    if (typeof projectPath !== "string" || typeof key !== "string") return { ok: false, error: "請再搜一次" };
    try {
      return await useCandidate(projectPath, key, remember === true);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "抓不到這份歌詞" };
    }
  });
  ipcMain.on("queue:listen", (event) => {
    event.sender.send("queue:update", listJobs());
  });

  ipcMain.handle("preview:save", async (_event, projectPath: unknown, timing: unknown, look: unknown, motion: unknown) => {
    if (typeof projectPath !== "string" || timing == null || typeof timing !== "object") return false;
    const nextLook = look != null && typeof look === "object" ? clampLook(look as Partial<LyricLook>) : undefined;
    await savePreviewTiming(
      projectPath,
      timingFromProject(timing as StoredTiming),
      nextLook,
      Array.isArray(motion) ? (motion as MotionClip[]) : undefined,
    );
    return true;
  });
  ipcMain.handle("look:chiron", async () => {
    const bytes = await readFile(join(resourceRoot(), "fonts", "ChironGoRoundTC-Regular.ttf"));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  });

  ipcMain.handle("import:save-file", (event, filePath: unknown, body: unknown) => foreground(event, "import", async () => {
    const parsed = request(body);
    if (typeof filePath !== "string" || !parsed) return { ok: false, error: IMPORT_FAIL };
    return saveLocal(filePath, parsed);
  }));
}
