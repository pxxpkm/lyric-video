import { afterEach, expect, it, vi } from "vitest";
const handlers = vi.hoisted(() => new Map<string, (...args: any[]) => any>());
vi.mock("electron", () => ({
  ipcMain: { handle: (name: string, fn: (...args: any[]) => any) => handlers.set(name, fn), on: vi.fn() },
  BrowserWindow: { getAllWindows: () => [], fromWebContents: () => null },
  dialog: { showOpenDialog: vi.fn(), showMessageBox: vi.fn() }, shell: {},
}));
vi.mock("../../src/main/cookieFile", () => ({ cookieStatus: vi.fn(), importCookieFile: vi.fn(), clearCookieFile: vi.fn() }));
import { dialog } from "electron";
import { importCookieFile, clearCookieFile } from "../../src/main/cookieFile";
import { registerImportIpc } from "../../src/main/ipc";
import { runToolOperation } from "../../src/main/toolOperations";
afterEach(() => vi.resetAllMocks());

it("取消選檔或清除確認不改 Cookie 副本", async () => {
  registerImportIpc();
  vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] });
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0, checkboxChecked: false });
  expect(await handlers.get("cookies:select")!({ sender: {} })).toMatchObject({ cancelled: true });
  expect(await handlers.get("cookies:clear")!({ sender: {} })).toMatchObject({ cancelled: true });
  expect(importCookieFile).not.toHaveBeenCalled();
  expect(clearCookieFile).not.toHaveBeenCalled();
});

it("工具工作進行中不允許匯入或清除 Cookie，亦不開對話框", async () => {
  let release!: () => void;
  const active = runToolOperation("cookie-test:busy", () => new Promise<void>(resolve => { release = resolve; }));
  try {
    expect(await handlers.get("cookies:select")!({ sender: {} })).toMatchObject({ ok: false });
    expect(await handlers.get("cookies:clear")!({ sender: {} })).toMatchObject({ ok: false });
    expect(dialog.showOpenDialog).not.toHaveBeenCalled();
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
  } finally { release(); await active; }
});
