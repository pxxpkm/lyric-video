import { BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from "electron";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { mp4FileName } from "../core/exportName";
import { exportProject, type ExportRequest } from "./exportVideo";
import { resourceRoot } from "./paths";
import { browseProject, matchProject, useCandidate } from "./matchLyrics";
import { enqueueFile, enqueueTest, enqueueUrls, listJobs, openJob } from "./queue";
import { readSettings, writeSettings } from "./settings";
import { describeFile, describeUrl, saveDownloaded, saveLocal } from "./importService";
import { IMPORT_FAIL } from "./media";
import { createTestClip, loadPreview, savePreviewTiming } from "./testClip";
import { clampLook, type LyricLook } from "../core/lyricLook";
import { timingFromProject } from "../core/projectTiming";
import type { StoredTiming } from "../shared/preview";
import type { SaveRequest } from "../shared/import";

let exportBusy = false;

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
  };
}

export function registerImportIpc(): void {
  ipcMain.handle("import:probe-url", async (_event, url: unknown, current: unknown) => {
    if (typeof url !== "string") return { ok: false, error: IMPORT_FAIL };
    return describeUrl(url, fields(current));
  });

  ipcMain.handle("import:probe-file", async (_event, filePath: unknown, current: unknown) => {
    if (typeof filePath !== "string") return { ok: false, error: IMPORT_FAIL };
    return describeFile(filePath, fields(current));
  });

  ipcMain.handle("import:download-url", async (event: IpcMainInvokeEvent, url: unknown, body: unknown) => {
    const parsed = request(body);
    if (typeof url !== "string" || !parsed) return { ok: false, error: IMPORT_FAIL };
    let lastSent = 0;
    return saveDownloaded(url, parsed, (percent) => {
      const now = Date.now();
      if (now - lastSent < 200) return;
      lastSent = now;
      event.sender.send("import:progress", `正在下載 ${Math.floor(percent)}%`);
    });
  });

  ipcMain.handle("preview:test-clip", () => createTestClip());
  ipcMain.handle("preview:load", (_event, projectPath: unknown) => {
    if (typeof projectPath !== "string") throw new Error("沒有專案");
    return loadPreview(projectPath);
  });
  ipcMain.handle("export:video", async (event: IpcMainInvokeEvent, body: unknown) => {
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
  });

  ipcMain.handle("settings:get", () => readSettings());
  ipcMain.handle("settings:set", (_event, showTrans: unknown) => writeSettings({ showTrans: showTrans !== false }));
  ipcMain.handle("queue:list", () => listJobs());
  ipcMain.handle("queue:urls", (_event, text: unknown) => {
    if (typeof text === "string") enqueueUrls(text);
    return listJobs();
  });
  ipcMain.handle("queue:file", (_event, filePath: unknown) => {
    if (typeof filePath === "string") enqueueFile(filePath);
    return listJobs();
  });
  ipcMain.handle("queue:test", () => enqueueTest());
  ipcMain.handle("queue:open", (_event, id: unknown) => {
    if (typeof id !== "string") return null;
    return openJob(id);
  });
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

  ipcMain.handle("preview:save", async (_event, projectPath: unknown, timing: unknown, look: unknown) => {
    if (typeof projectPath !== "string" || timing == null || typeof timing !== "object") return false;
    const nextLook = look != null && typeof look === "object" ? clampLook(look as Partial<LyricLook>) : undefined;
    await savePreviewTiming(projectPath, timingFromProject(timing as StoredTiming), nextLook);
    return true;
  });
  ipcMain.handle("look:chiron", async () => {
    const bytes = await readFile(join(resourceRoot(), "fonts", "ChironGoRoundTC-Regular.ttf"));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  });

  ipcMain.handle("import:save-file", async (_event, filePath: unknown, body: unknown) => {
    const parsed = request(body);
    if (typeof filePath !== "string" || !parsed) return { ok: false, error: IMPORT_FAIL };
    return saveLocal(filePath, parsed);
  });
}
