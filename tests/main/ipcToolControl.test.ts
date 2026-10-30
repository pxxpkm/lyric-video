import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
const handlers = vi.hoisted(() => new Map<string, (...args: any[]) => any>());
vi.mock("electron", () => ({
  ipcMain: { handle: (name: string, fn: (...args: any[]) => any) => handlers.set(name, fn), on: vi.fn() },
  BrowserWindow: { getAllWindows: () => [] }, dialog: {}, shell: {},
}));
vi.mock("../../src/main/importService", () => ({ describeUrl: vi.fn() }));
import { describeUrl } from "../../src/main/importService";
import { currentToolSignal } from "../../src/main/toolOperations";
import { registerImportIpc } from "../../src/main/ipc";

function sender(id: number) {
  return Object.assign(new EventEmitter(), { id, send: vi.fn(), isDestroyed: () => false });
}

it("取消 IPC 限制同一視窗及工作，完成清狀態後可重試", async () => {
  registerImportIpc();
  const owner = sender(1), other = sender(2);
  vi.mocked(describeUrl).mockImplementation(async () => {
    await new Promise<void>(resolve => currentToolSignal()!.addEventListener("abort", () => resolve(), { once: true }));
    return { ok: false, error: "已取消工作，可以重試。" };
  });
  const pending = handlers.get("import:probe-url")!({ sender: owner }, "https://test.invalid", {});
  expect(owner.send).toHaveBeenCalledWith("tool:state", { kind: "import", active: true });
  expect(handlers.get("tool:cancel")!({ sender: other }, "import")).toBe(false);
  expect(handlers.get("tool:cancel")!({ sender: owner }, "export")).toBe(false);
  const overlap = await handlers.get("import:probe-url")!({ sender: owner }, "https://test.invalid", {});
  expect(overlap.ok).toBe(false);
  expect(owner.send).toHaveBeenCalledTimes(1);
  expect(handlers.get("tool:cancel")!({ sender: owner }, "import")).toBe(true);
  expect((await pending).error).toContain("已取消");
  expect(owner.send).toHaveBeenLastCalledWith("tool:state", { kind: "import", active: false });
  expect(owner.listenerCount("destroyed")).toBe(0);
  vi.mocked(describeUrl).mockResolvedValue({ ok: true, draft: { title: "retry", artist: "", durationMs: 1000, mode: "video", useDuration: true, note: "" } });
  expect((await handlers.get("import:probe-url")!({ sender: owner }, "https://test.invalid", {})).ok).toBe(true);
});

it("視窗銷毀會取消其工具工作並移除事件監聽", async () => {
  const owner = sender(3);
  vi.mocked(describeUrl).mockImplementation(async () => {
    const signal = currentToolSignal()!;
    await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
    expect(signal.aborted).toBe(true);
    return { ok: false, error: "已取消" };
  });
  const pending = handlers.get("import:probe-url")!({ sender: owner }, "https://test.invalid", {});
  owner.emit("destroyed");
  expect((await pending).ok).toBe(false);
  expect(owner.listenerCount("destroyed")).toBe(0);
});
