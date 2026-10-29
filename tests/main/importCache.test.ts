import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../src/main/mediaCache", () => ({ findCachedMedia: vi.fn() }));
vi.mock("../../src/main/media", () => ({ downloadUrl: vi.fn(), probeFile: vi.fn(), probeUrl: vi.fn(), IMPORT_FAIL: "失敗" }));
vi.mock("../../src/main/projectFile", () => ({ saveProject: vi.fn() }));
import { findCachedMedia } from "../../src/main/mediaCache";
import { downloadUrl, probeFile } from "../../src/main/media";
import { saveProject } from "../../src/main/projectFile";
import { saveDownloaded } from "../../src/main/importService";

afterEach(() => vi.resetAllMocks());
const request = { title: "歌名", artist: "歌手", durationMs: 217000, mode: "video" as const, lockTitle: false, lockArtist: false };
const url = "https://youtu.be/BFSmN6fQ_04";

it("命中素材不下載，每次另建專案而保留新設定", async () => {
  vi.mocked(findCachedMedia).mockResolvedValue({ mediaPath: "existing/source.webm", durationMs: 217000 });
  const progress = vi.fn();
  const first = await saveDownloaded(url, request, progress);
  const second = await saveDownloaded(url, { ...request, title: "另一歌名" });
  expect(downloadUrl).not.toHaveBeenCalled();
  expect(first.ok && first.mediaPath).toBe("existing/source.webm");
  expect(first.ok && second.ok && first.projectPath !== second.projectPath).toBe(true);
  expect(saveProject).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ identity: expect.objectContaining({ title: "另一歌名" }) }));
  expect(progress).toHaveBeenCalledWith(100);
});

it("沒有有效素材才下載，下載失敗不建立專案", async () => {
  vi.mocked(findCachedMedia).mockResolvedValue(null);
  vi.mocked(downloadUrl).mockResolvedValue({ ok: false, error: "失敗" });
  expect(await saveDownloaded(url, request)).toEqual({ ok: false, error: "失敗" });
  expect(downloadUrl).toHaveBeenCalledOnce();
  expect(saveProject).not.toHaveBeenCalled();
});

it("新下載成功才保存專案", async () => {
  vi.mocked(findCachedMedia).mockResolvedValue(null);
  vi.mocked(downloadUrl).mockResolvedValue({ ok: true, mediaPath: "new/source.webm" });
  vi.mocked(probeFile).mockResolvedValue(217000);
  expect(await saveDownloaded(url, request)).toEqual({ ok: true, projectPath: expect.any(String), mediaPath: "new/source.webm" });
  expect(saveProject).toHaveBeenCalledOnce();
});
