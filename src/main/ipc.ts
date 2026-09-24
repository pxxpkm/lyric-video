import { ipcMain, type IpcMainInvokeEvent } from "electron";
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
