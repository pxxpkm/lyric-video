import { afterEach, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cacheEntry, listCache, trashCacheEntries } from "../../src/main/cacheLibrary";
import { recordDownloadFiles, RECEIPT } from "../../src/main/downloadReceipt";
import { exampleProject } from "../../src/core/project";
import { saveProject, updateProject } from "../../src/main/projectFile";
import { resumeProject } from "../../src/main/matchLyrics";
import { readFile } from "node:fs/promises";

const roots: string[] = [];

it("批次只清除確認時清單，失敗繼續並回報，拒絕外部路徑", async () => {
  const { root, folder, path } = await fixture();
  await writeFile(join(folder, "source.mp4.part"), "partial");
  await recordDownloadFiles(folder);
  const entries = await listCache(root);
  await writeFile(join(folder, "source.new.webm"), "new");
  const calls: string[] = [];
  const result = await trashCacheEntries(root, [...entries, { ...entries[0], path: join(root, "outside.mp4"), name: "outside" }], async (file) => {
    calls.push(file);
    if (file === path) throw new Error("locked");
  }, () => true);
  expect(calls).toHaveLength(2);
  expect(result.cleared).toBe(1);
  expect(result.failed).toHaveLength(2);
  expect(calls).not.toContain(join(folder, "source.new.webm"));
});

it("有工作處理中時批次不執行清除", async () => {
  const { root } = await fixture();
  let called = false;
  const result = await trashCacheEntries(root, await listCache(root), async () => { called = true; }, () => false);
  expect(called).toBe(false);
  expect(result.cleared).toBe(0);
  expect(result.failed).toHaveLength(1);
});
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "lyric-library-"));
  roots.push(root);
  const folder = join(root, "yt-old");
  await mkdir(folder);
  const path = join(folder, "source.webm");
  await writeFile(path, "media");
  await writeFile(join(folder, "project.json"), JSON.stringify({ identity: { title: "歌名" }, source: { kind: "youtube", url: "https://youtu.be/BFSmN6fQ_04", mediaPath: path } }));
  return { root, folder, path };
}

it("按素材檔案列大小，顯示所有引用專案，不重複計算共用素材", async () => {
  const { root, path } = await fixture();
  await mkdir(join(root, "yt-new"));
  await writeFile(join(root, "yt-new", "project.json"), JSON.stringify({ identity: { title: "新設定" }, source: { mediaPath: path } }));
  const rows = await listCache(root);
  expect(rows).toHaveLength(1);
  expect(rows[0].bytes).toBe(5);
  expect(rows[0].projects).toEqual(expect.arrayContaining(["歌名（yt-old）", "新設定（yt-new）"]));
  expect(await cacheEntry(root, path)).toEqual(rows[0]);
});

it("只允許 yt 資料夾來源素材，不包含 Cookies、本機原片、專案或一般匯出檔", async () => {
  const { root, folder } = await fixture();
  await writeFile(join(root, "cookies.txt"), "private");
  await writeFile(join(folder, "成片.mp4"), "export");
  await mkdir(join(root, "file-local"));
  const local = join(root, "file-local", "source.mp4");
  await writeFile(local, "local");
  expect(await listCache(root)).toHaveLength(1);
  expect(await cacheEntry(root, local)).toBeNull();
  expect(await cacheEntry(root, join(root, "..", "source.webm"))).toBeNull();
  expect(await cacheEntry(root, join(folder, "project.json"))).toBeNull();
});

it("未完成下載亦列出；沒有專案或專案損壞不影響列檔", async () => {
  const { root, folder } = await fixture();
  await writeFile(join(folder, "source.webm.part"), "partial");
  await writeFile(join(folder, "project.json"), "broken");
  const rows = await listCache(root);
  expect(rows).toHaveLength(2);
  expect(rows.every((row) => row.projects.length === 0)).toBe(true);
  expect(rows.every((row) => !row.clearable)).toBe(true);
  expect(rows.every((row) => row.projectLinks.length === 0)).toBe(true);
});

it("共用素材列出各自可編輯專案，從連結開最新設定且不改寫檔案", async () => {
  const { root, folder, path } = await fixture();
  const firstPath = join(folder, "project.json");
  const secondPath = join(root, "yt-second", "project.json");
  const first = exampleProject();
  first.identity.title = "版本一";
  first.source = { kind: "youtube", url: "https://youtu.be/BFSmN6fQ_04", mediaPath: path, mode: "video" };
  await saveProject(firstPath, first);
  const second = structuredClone(first);
  second.identity.title = "版本二";
  second.style.size = 88;
  await saveProject(secondPath, second);
  const rows = await listCache(root);
  expect(rows).toHaveLength(1);
  expect(rows[0].projectLinks).toEqual(expect.arrayContaining([
    { projectPath: firstPath, label: "版本一（yt-old）" },
    { projectPath: secondPath, label: "版本二（yt-second）" },
  ]));
  await updateProject(firstPath, (project) => { project.style.size = 77; project.timing.offsetMs = 1500; return project; });
  const before = await readFile(firstPath, "utf8");
  const link = rows[0].projectLinks.find((project) => project.projectPath === firstPath)!;
  const opened = await resumeProject(link.projectPath);
  expect(opened.session.look.size).toBe(77);
  expect(opened.session.timing.offsetMs).toBe(1500);
  expect((await resumeProject(secondPath)).session.look.size).toBe(88);
  expect(await readFile(firstPath, "utf8")).toBe(before);
});

it("舊專案只認明確來源，source.final.mp4 成片保留且批次拒絕清除", async () => {
  const { root, folder, path } = await fixture();
  const exported = join(folder, "source.final.mp4");
  await writeFile(exported, "export");
  const rows = await listCache(root);
  expect(rows.find((row) => row.path === path)?.clearable).toBe(true);
  expect(rows.find((row) => row.path === exported)?.clearable).toBe(false);
  expect(await cacheEntry(root, exported)).toBeNull();
  const calls: string[] = [];
  const result = await trashCacheEntries(root, rows, async (file) => { calls.push(file); }, () => true);
  expect(calls).toEqual([path]);
  expect(result.failed).toHaveLength(1);
});

it("下載紀錄只接納當時檔案，後加成片或修改來源不允許清除", async () => {
  const { root, folder, path } = await fixture();
  await writeFile(join(folder, "source.webm.part"), "partial");
  await recordDownloadFiles(folder);
  expect((await listCache(root)).filter((row) => row.clearable)).toHaveLength(2);
  const before = await listCache(root);
  await writeFile(join(folder, "source.final.mp4"), "export");
  await writeFile(path, "replaced with different content");
  expect(await cacheEntry(root, path)).toBeNull();
  expect(await cacheEntry(root, join(folder, "source.final.mp4"))).toBeNull();
  const calls: string[] = [];
  const result = await trashCacheEntries(root, before, async (file) => { calls.push(file); }, () => true);
  expect(calls).toEqual([join(folder, "source.webm.part")]);
  expect(result.failed).toHaveLength(1);
});

it("損壞下載紀錄不退回舊版規則；本機來源不可當下載清除", async () => {
  const { root, folder, path } = await fixture();
  await writeFile(join(folder, RECEIPT), "broken json");
  expect(await cacheEntry(root, path)).toBeNull();
  await rm(join(folder, RECEIPT));
  await writeFile(join(folder, "project.json"), JSON.stringify({ source: { kind: "file", mediaPath: path } }));
  expect(await cacheEntry(root, path)).toBeNull();
});

it("素材已移除就不能清除；資料夾不存在回傳空表", async () => {
  const { root, path } = await fixture();
  await rm(path);
  expect(await cacheEntry(root, path)).toBeNull();
  expect(await listCache(join(root, "missing"))).toEqual([]);
});
