import { ipcMain, shell, type IpcMainInvokeEvent } from "electron";
import { join } from "node:path";
import { exportProject, type ExportRequest } from "./exportVideo";
import { describeFile, describeUrl, saveDownloaded, saveLocal } from "./importService";
import { IMPORT_FAIL } from "./media";
import { createTestClip, loadPreview, savePreviewTiming } from "./testClip";
import { timingFromProject } from "../core/projectTiming";
import type { StoredTiming } from "../shared/preview";
import type { SaveRequest } from "../shared/import";

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
    const result = await exportProject(request, join(process.cwd(), "fonts"), (text) => {
      const now = Date.now();
      if (now - last < 200 && !text.startsWith("匯出")) return;
      last = now;
      event.sender.send("export:progress", text);
    });
    if (result.ok) await shell.openPath(result.outPath);
    return result;
  });

  ipcMain.handle("preview:save", async (_event, projectPath: unknown, timing: unknown) => {
    if (typeof projectPath !== "string" || timing == null || typeof timing !== "object") return false;
    await savePreviewTiming(projectPath, timingFromProject(timing as StoredTiming));
    return true;
  });

  ipcMain.handle("import:save-file", async (_event, filePath: unknown, body: unknown) => {
    const parsed = request(body);
    if (typeof filePath !== "string" || !parsed) return { ok: false, error: IMPORT_FAIL };
    return saveLocal(filePath, parsed);
  });
}
