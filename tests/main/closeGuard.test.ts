import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";
vi.mock("electron", () => ({ ipcMain: new EventEmitter(), dialog: { showMessageBox: vi.fn().mockResolvedValue({ response: 0 }) } }));
vi.mock("../../src/main/projectFile", () => ({ waitAllProjectWrites: vi.fn().mockResolvedValue(undefined) }));
import { dialog, ipcMain } from "electron";
import { installCloseGuard } from "../../src/main/closeGuard";
import { waitAllProjectWrites } from "../../src/main/projectFile";

const windows: EventEmitter[] = [];
afterEach(() => {
  for (const win of windows.splice(0)) win.emit("closed");
  vi.useRealTimers();
  vi.clearAllMocks();
});

function windowFixture() {
  const win = Object.assign(new EventEmitter(), {
    webContents: Object.assign(new EventEmitter(), { send: vi.fn() }),
    isDestroyed: () => false,
    close: vi.fn(),
  });
  windows.push(win);
  installCloseGuard(win as unknown as BrowserWindow);
  return win;
}

it("關閉先阻擋，只有正確視窗及 token 保存成功才放行", async () => {
  const win = windowFixture();
  const preventDefault = vi.fn();
  win.emit("close", { preventDefault });
  expect(preventDefault).toHaveBeenCalledOnce();
  const token = win.webContents.send.mock.calls[0][1];
  ipcMain.emit("window:close-ready", { sender: {} }, token, true);
  ipcMain.emit("window:close-ready", { sender: win.webContents }, "stale-token", true);
  expect(win.close).not.toHaveBeenCalled();
  ipcMain.emit("window:close-ready", { sender: win.webContents }, token, true);
  await vi.waitFor(() => expect(win.close).toHaveBeenCalledOnce());
  expect(win.close).toHaveBeenCalledOnce();
  const finalPrevent = vi.fn();
  win.emit("close", { preventDefault: finalPrevent });
  expect(finalPrevent).not.toHaveBeenCalled();
});

it("保存失敗保留視窗，可再次關閉重試", async () => {
  const win = windowFixture();
  win.emit("close", { preventDefault: vi.fn() });
  const token = win.webContents.send.mock.calls[0][1];
  ipcMain.emit("window:close-ready", { sender: win.webContents }, token, false);
  expect(win.close).not.toHaveBeenCalled();
  win.emit("close", { preventDefault: vi.fn() });
  expect(win.webContents.send).toHaveBeenCalledTimes(2);
  const retry = win.webContents.send.mock.calls[1][1];
  expect(retry).not.toBe(token);
  ipcMain.emit("window:close-ready", { sender: win.webContents }, retry, true);
  await vi.waitFor(() => expect(win.close).toHaveBeenCalledOnce());
  expect(win.close).toHaveBeenCalledOnce();
});

it("畫面已保存仍等待主程序在途寫入，寫入失敗不關閉", async () => {
  let reject!: (reason: Error) => void;
  vi.mocked(waitAllProjectWrites).mockImplementationOnce(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
  const win = windowFixture();
  win.emit("close", { preventDefault: vi.fn() });
  const token = win.webContents.send.mock.calls[0][1];
  ipcMain.emit("window:close-ready", { sender: win.webContents }, token, true);
  expect(win.close).not.toHaveBeenCalled();
  reject(new Error("disk error"));
  await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalledOnce());
  expect(win.close).not.toHaveBeenCalled();
});

it("畫面無回應時逾時提示且不強制關閉，舊回覆不能關窗", async () => {
  vi.useFakeTimers();
  const win = windowFixture();
  win.emit("close", { preventDefault: vi.fn() });
  win.emit("close", { preventDefault: vi.fn() });
  expect(win.webContents.send).toHaveBeenCalledTimes(1);
  const token = win.webContents.send.mock.calls[0][1];
  await vi.advanceTimersByTimeAsync(10000);
  expect(dialog.showMessageBox).toHaveBeenCalledOnce();
  ipcMain.emit("window:close-ready", { sender: win.webContents }, token, true);
  expect(win.close).not.toHaveBeenCalled();
});
