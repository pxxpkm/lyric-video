import { dialog, ipcMain, type BrowserWindow, type IpcMainEvent } from "electron";
import { randomUUID } from "node:crypto";
import { waitAllProjectWrites } from "./projectFile";

export function installCloseGuard(win: BrowserWindow): void {
  let allowed = false;
  let token: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const reply = async (event: IpcMainEvent, received: unknown, ok: unknown) => {
    if (event.sender !== win.webContents || !token || received !== token) return;
    if (ok !== true) {
      clearTimeout(timer);
      token = null;
      return;
    }
    try { await waitAllProjectWrites(); }
    catch {
      if (received !== token) return;
      clearTimeout(timer);
      token = null;
      if (!win.isDestroyed()) void dialog.showMessageBox(win, { type: "warning", title: "未能完成保存", message: "專案寫入失敗，視窗已保留。請檢查保存狀態並重試。" });
      return;
    }
    if (received !== token || win.isDestroyed()) return;
    clearTimeout(timer);
    token = null;
    allowed = true;
    win.close();
  };
  ipcMain.on("window:close-ready", reply);
  win.on("close", (event) => {
    if (allowed) return;
    event.preventDefault();
    if (token) return;
    token = randomUUID();
    win.webContents.send("window:request-close", token);
    timer = setTimeout(() => {
      token = null;
      if (!win.isDestroyed()) void dialog.showMessageBox(win, {
        type: "warning", title: "尚未關閉", message: "未收到保存確認，視窗已保留。請確認畫面載入完成，或等保存完成後再關閉。",
      });
    }, 10000);
  });
  win.webContents.on("will-prevent-unload", () => { allowed = false; });
  win.on("closed", () => {
    clearTimeout(timer);
    ipcMain.removeListener("window:close-ready", reply);
  });
}
