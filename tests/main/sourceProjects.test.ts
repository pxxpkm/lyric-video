import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exampleProject } from "../../src/core/project";
import { clampLook } from "../../src/core/lyricLook";
import { placeLineClip } from "../../src/core/motion";
import { saveProject, updateProject } from "../../src/main/projectFile";
import { findSourceProjects } from "../../src/main/sourceProjects";
import { resumeProject } from "../../src/main/matchLyrics";
import { ImportProjectFlow } from "../../src/renderer/src/importProjectFlow";
import type { ImportSource, SaveRequest } from "../../src/shared/import";

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
const source: ImportSource = { kind: "youtube", url: "https://www.youtube.com/watch?v=BFSmN6fQ_04" };
const request: SaveRequest = { title: "歌", artist: "歌手", durationMs: 217000, mode: "video", lockTitle: false, lockArtist: false };
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "lyric-source-projects-"));
  roots.push(root);
  return root;
}
async function create(root: string, name: string, input: ImportSource = source, mode: "video" | "audio" = "video") {
  const path = join(root, name, "project.json");
  const project = exampleProject();
  project.source = input.kind === "youtube" ? { kind: "youtube", url: input.url, mediaPath: join(root, name, "source.webm"), mode } : { kind: "file", url: "", mediaPath: input.path, mode };
  project.identity = { ...project.identity, title: "歌", artist: "歌手", durationMs: 217000 };
  await saveProject(path, project);
  return path;
}

it("完整重啟後相同長短連結找回硬碟專案，續編保留字級／延遲／文字／隱藏及直排設定，不重寫", async () => {
  const root = await fixture();
  let count = 0;
  const api = {
    downloadUrl: vi.fn(async () => ({ ok: true as const, projectPath: await create(root, `yt-${count++}`), mediaPath: "source.webm" })),
    saveFile: vi.fn(async () => { throw new Error("Unexpected local import"); }),
    findSourceProjects: vi.fn((input: ImportSource) => findSourceProjects(root, input)),
    resumeProject: vi.fn(resumeProject), matchProject: vi.fn(resumeProject),
  };
  const first = await new ImportProjectFlow().open(source, request, api);
  if (!("session" in first)) throw new Error("Expected project");
  const path = first.session.projectPath;
  await updateProject(path, (project) => {
    project.timing.offsetMs = 1250; project.timing.texts = { line: "修改歌詞" };
    project.style.size = 77; project.style.flow = "vertical"; project.style.verticalAnchor = "first"; project.style.showOriginal = false;
    project.motion = placeLineClip([], "1000|修改歌詞", "修改歌詞", 1000, 3000, .3, .2, clampLook(project.style));
    return project;
  });
  const before = await readFile(path, "utf8");
  // 新控制器代表上一程序記憶已消失，只靠硬碟資料。
  const restarted = new ImportProjectFlow();
  const short: ImportSource = { kind: "youtube", url: "https://youtu.be/BFSmN6fQ_04?t=12" };
  const found = await restarted.open(short, request, api);
  if ("ok" in found || found.kind !== "existing-projects") throw new Error("Expected project choice");
  expect(found.projects.map((project) => project.projectPath)).toEqual([path]);
  const resumed = await restarted.continueWith(short, request, path, api);
  if (!("session" in resumed)) throw new Error("Expected project");
  expect(resumed.session.look).toMatchObject({ size: 77, flow: "vertical", verticalAnchor: "first", showOriginal: false });
  expect(resumed.session.timing).toMatchObject({ offsetMs: 1250, texts: { line: "修改歌詞" } });
  expect(resumed.session.motion).toEqual(JSON.parse(before).motion);
  expect(await readFile(path, "utf8")).toBe(before);
  expect(api.downloadUrl).toHaveBeenCalledOnce();
  expect(api.matchProject).toHaveBeenCalledOnce();
});

it("多份專案依保存時間列出，跨影音模式不漏掉；選哪份才開哪份", async () => {
  const root = await fixture();
  const edited = await create(root, "yt-edited", source, "audio");
  const newer = await create(root, "yt-new");
  await updateProject(edited, (project) => { project.style.size = 88; return project; });
  await utimes(edited, new Date(1000), new Date(1000));
  await utimes(newer, new Date(2000), new Date(2000));
  const rows = await findSourceProjects(root, source);
  expect(rows.map((project) => project.projectPath)).toEqual([newer, edited]);
  expect(rows[1]).toMatchObject({ fontSize: 88, mode: "audio", mediaAvailable: false });
  expect((await resumeProject(edited)).session.look.size).toBe(88);
});

it("其他影片、相似網域及其他本機檔案不混入；壞檔略過但不改寫", async () => {
  const root = await fixture();
  await create(root, "yt-other", { kind: "youtube", url: "https://youtu.be/abcdefghijk" });
  await create(root, "yt-fake", { kind: "youtube", url: "https://youtube.com.example.com/watch?v=BFSmN6fQ_04" });
  const local: ImportSource = { kind: "file", path: join(root, "original.mp4") };
  const localPath = await create(root, "file-local", local);
  expect(await findSourceProjects(root, source)).toEqual([]);
  expect((await findSourceProjects(root, local)).map((project) => project.projectPath)).toEqual([localPath]);
  await writeFile(localPath, "broken json");
  expect(await findSourceProjects(root, local)).toEqual([]);
  expect(await readFile(localPath, "utf8")).toBe("broken json");
  expect(await findSourceProjects(join(root, "missing"), source)).toEqual([]);
});

it("明確選另建新專案才建立，尋找失敗不偷偷下載", async () => {
  const root = await fixture();
  const old = await create(root, "yt-old");
  const before = await readFile(old, "utf8");
  const api = {
    downloadUrl: vi.fn(async () => ({ ok: true as const, projectPath: await create(root, "yt-new"), mediaPath: "source.webm" })),
    saveFile: vi.fn(async () => { throw new Error("unused"); }),
    findSourceProjects: vi.fn((input: ImportSource) => findSourceProjects(root, input)),
    resumeProject: vi.fn(resumeProject), matchProject: vi.fn(resumeProject),
  };
  const flow = new ImportProjectFlow();
  await flow.open(source, request, api);
  expect(api.downloadUrl).not.toHaveBeenCalled();
  await flow.open(source, request, api, true);
  expect(api.downloadUrl).toHaveBeenCalledOnce();
  expect(await readFile(old, "utf8")).toBe(before);
  api.findSourceProjects.mockRejectedValueOnce(new Error("permission error"));
  await expect(new ImportProjectFlow().open(source, request, api)).rejects.toThrow("permission error");
  expect(api.downloadUrl).toHaveBeenCalledOnce();
});
