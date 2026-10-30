import { afterEach, expect, it, vi } from "vitest";
import { flushActiveSave, ProjectSaver, registerActiveSave } from "../../src/renderer/src/projectSaver";

afterEach(() => vi.useRealTimers());

it("載入不寫檔，短時間多次修改只保存最後版本", async () => {
  vi.useFakeTimers();
  const write = vi.fn().mockResolvedValue(undefined);
  const saver = new ProjectSaver({ size: 40 }, write);
  await saver.flush();
  expect(write).not.toHaveBeenCalled();
  saver.update({ size: 41 });
  saver.update({ size: 42 });
  await vi.advanceTimersByTimeAsync(200);
  expect(write).toHaveBeenCalledTimes(1);
  expect(write).toHaveBeenCalledWith({ size: 42 });
  expect(saver.status).toBe("saved");
});

it("立即離開會越過 debounce，保存未完成前不回報成功", async () => {
  vi.useFakeTimers();
  let finish!: () => void;
  const write = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  const saver = new ProjectSaver({ size: 40 }, write);
  saver.update({ size: 50 });
  const flush = saver.flush();
  expect(saver.status).toBe("saving");
  expect(write).toHaveBeenCalledWith({ size: 50 });
  finish();
  expect(await flush).toBe(true);
  expect(saver.status).toBe("saved");
});

it("慢保存中又修改，依次寫入最後版本而非並行", async () => {
  vi.useFakeTimers();
  let finish!: () => void;
  const write = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; })).mockResolvedValue(undefined);
  const saver = new ProjectSaver<number>(0, write);
  saver.update(1);
  const flushing = saver.flush();
  saver.update(2);
  await vi.advanceTimersByTimeAsync(200);
  expect(write).toHaveBeenCalledTimes(1);
  finish();
  expect(await flushing).toBe(true);
  expect(write.mock.calls.map(([value]) => value)).toEqual([1, 2]);
  expect(saver.status).toBe("saved");
});

it("失敗保留最新修改並阻止離開，重試成功才可離開", async () => {
  const write = vi.fn().mockRejectedValueOnce(new Error("disk error")).mockResolvedValue(undefined);
  const saver = new ProjectSaver<number>(0, write);
  const unregister = registerActiveSave(() => saver.flush());
  try {
    saver.update(1);
    expect(await flushActiveSave()).toBe(false);
    expect(saver.status).toBe("error");
    expect(await flushActiveSave()).toBe(true);
    expect(write.mock.calls.map(([value]) => value)).toEqual([1, 1]);
    expect(saver.status).toBe("saved");
  } finally { unregister(); }
  expect(await flushActiveSave()).toBe(true);
});

it("儲存中的修改改回原值，仍會寫回最新值", async () => {
  let finish!: () => void;
  const write = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; })).mockResolvedValue(undefined);
  const saver = new ProjectSaver<number>(0, write);
  saver.update(1);
  const flush = saver.flush();
  saver.update(0);
  finish();
  await flush;
  expect(write.mock.calls.map(([value]) => value)).toEqual([1, 0]);
});
