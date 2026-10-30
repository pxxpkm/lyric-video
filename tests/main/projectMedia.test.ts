import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("../../src/main/media", () => ({ downloadUrl: vi.fn(), probeFile: vi.fn() }));
import { downloadUrl, probeFile } from "../../src/main/media";
import { ensureProjectMedia, mediaRecoveryBusy } from "../../src/main/projectMedia";
import { saveProject, updateProject } from "../../src/main/projectFile";
import { exampleProject } from "../../src/core/project";
import { setRoots } from "../../src/main/paths";
import { recordDownloadFiles } from "../../src/main/downloadReceipt";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "lyric-repair-"));
  setRoots({ studio: () => root, resources: () => process.cwd() });
  vi.mocked(probeFile).mockResolvedValue(217000);
  vi.mocked(downloadUrl).mockImplementation(async (_url, directory, _mode, progress) => {
    await mkdir(directory, { recursive: true });
    const mediaPath = join(directory, "source.webm");
    await writeFile(mediaPath, "downloaded-media");
    await recordDownloadFiles(directory);
    progress?.(100);
    return { ok: true, mediaPath };
  });
});
afterEach(async () => {
  setRoots({ studio: () => join(process.cwd(), "studio-data"), resources: () => process.cwd() });
  vi.resetAllMocks();
  await rm(root, { recursive: true, force: true });
});

async function project(name: string, mode: "video" | "audio" = "video") {
  const path = join(root, `yt-${name}`, "project.json");
  const value = exampleProject();
  value.source = { kind: "youtube", url: "https://youtu.be/BFSmN6fQ_04", mode, mediaPath: join(root, "deleted", "source.webm") };
  value.identity.title = "已編輯";
  value.timing.offsetMs = 1500;
  value.timing.texts = { line: "修改歌詞" };
  value.style.size = 77;
  value.style.flow = "vertical";
  value.style.verticalAnchor = "first";
  value.style.showOriginal = false;
  await saveProject(path, value);
  return path;
}
async function read(path: string) { return JSON.parse(await readFile(path, "utf8")); }

it("來源尚在時直接開啟，不下載或重寫設定", async () => {
  const path = await project("healthy");
  const data = await read(path);
  await mkdir(join(root, "deleted"));
  await writeFile(data.source.mediaPath, "original-media");
  const before = await readFile(path, "utf8");
  await ensureProjectMedia(path);
  expect(downloadUrl).not.toHaveBeenCalled();
  expect(await readFile(path, "utf8")).toBe(before);
});

it("刪除後先重用其他專案的同來源副本，只更新原專案素材路徑", async () => {
  const path = await project("missing");
  const other = await project("cached");
  const cache = join(root, "yt-cached", "source.webm");
  await writeFile(cache, "cached-media");
  await updateProject(other, (value) => { value.source.mediaPath = cache; return value; });
  const before = await read(path);
  await ensureProjectMedia(path);
  const after = await read(path);
  expect(after).toEqual({ ...before, source: { ...before.source, mediaPath: cache } });
  expect(downloadUrl).not.toHaveBeenCalled();
});

it("沒有副本才下載，接回同一專案，保留下載期間的新編輯", async () => {
  const path = await project("recover");
  const original = await read(path);
  const performDownload = vi.mocked(downloadUrl).getMockImplementation()!;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  vi.mocked(downloadUrl).mockImplementation(async (...args) => { await gate; return performDownload(...args); });
  const progress = vi.fn();
  const repair = ensureProjectMedia(path, progress);
  await vi.waitFor(() => expect(downloadUrl).toHaveBeenCalledOnce());
  expect(mediaRecoveryBusy()).toBe(true);
  await updateProject(path, (value) => { value.style.size = 88; return value; });
  release();
  await repair;
  const after = await read(path);
  expect(after).toEqual({ ...original, source: { ...original.source, mediaPath: after.source.mediaPath }, style: { ...original.style, size: 88 } });
  expect(after.source.mediaPath).not.toBe(original.source.mediaPath);
  expect((await stat(after.source.mediaPath)).size).toBeGreaterThan(0);
  expect(progress).toHaveBeenCalledWith("來源素材已補回，正在開啟原專案");
  expect(mediaRecoveryBusy()).toBe(false);
});

it("多個舊版本同時續編，同來源只下載一次，各自設定保留", async () => {
  const first = await project("one");
  const second = await project("two");
  await updateProject(second, (value) => { value.style.size = 99; return value; });
  await Promise.all([ensureProjectMedia(first), ensureProjectMedia(second), ensureProjectMedia(first)]);
  expect(downloadUrl).toHaveBeenCalledOnce();
  expect((await read(first)).source.mediaPath).toBe((await read(second)).source.mediaPath);
  expect((await read(first)).style.size).toBe(77);
  expect((await read(second)).style.size).toBe(99);
});

it("下載失敗保留原檔，重試可成功補回", async () => {
  const path = await project("retry");
  const before = await readFile(path, "utf8");
  vi.mocked(downloadUrl).mockResolvedValueOnce({ ok: false, error: "YouTube 要求登入，請改拖本機檔。" });
  await expect(ensureProjectMedia(path)).rejects.toThrow("原專案設定仍然保留");
  expect(await readFile(path, "utf8")).toBe(before);
  expect(mediaRecoveryBusy()).toBe(false);
  await ensureProjectMedia(path);
  expect(downloadUrl).toHaveBeenCalledTimes(2);
  expect((await read(path)).style.size).toBe(77);
});

it("已補回素材再次清除仍可再補，影音模式互不混用", async () => {
  const video = await project("video");
  const audio = await project("audio", "audio");
  await ensureProjectMedia(video);
  const firstMedia = (await read(video)).source.mediaPath;
  await rm(firstMedia);
  await ensureProjectMedia(video);
  await ensureProjectMedia(audio);
  expect(downloadUrl).toHaveBeenCalledTimes(3);
  expect((await read(video)).source.mediaPath).not.toBe(firstMedia);
  expect((await read(audio)).source.mediaPath).not.toBe((await read(video)).source.mediaPath);
});

it("下載素材不可讀或本機原檔遺失時不切入空白預覽，專案不變", async () => {
  const path = await project("broken");
  let before = await readFile(path, "utf8");
  vi.mocked(probeFile).mockResolvedValue(null);
  await expect(ensureProjectMedia(path)).rejects.toThrow("下載的來源素材未能讀取");
  expect(await readFile(path, "utf8")).toBe(before);
  await updateProject(path, (value) => { value.source.kind = "file"; value.source.url = ""; return value; });
  before = await readFile(path, "utf8");
  vi.mocked(downloadUrl).mockClear();
  await expect(ensureProjectMedia(path)).rejects.toThrow("本機來源檔已被刪除或移走");
  expect(downloadUrl).not.toHaveBeenCalled();
  expect(await readFile(path, "utf8")).toBe(before);
});
