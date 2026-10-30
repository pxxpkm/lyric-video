import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exampleProject } from "../../src/core/project";
import { saveProject, updateProject } from "../../src/main/projectFile";
import { resumeProject } from "../../src/main/matchLyrics";
import { ImportProjectFlow } from "../../src/renderer/src/importProjectFlow";

const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
const source = { kind: "file" as const, path: "original.mp4" };
const request = { title: "歌名", artist: "歌手", durationMs: 217000, mode: "video" as const, lockTitle: false, lockArtist: false };

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "lyric-import-flow-"));
  dirs.push(dir);
  let index = 0;
  const api = {
    saveFile: vi.fn(async () => {
      const projectPath = join(dir, `project-${index++}.json`);
      await saveProject(projectPath, exampleProject());
      return { ok: true as const, projectPath, mediaPath: source.path };
    }),
    downloadUrl: vi.fn(async () => { throw new Error("unexpected download"); }),
    matchProject: vi.fn(resumeProject),
    resumeProject: vi.fn(resumeProject),
    findSourceProjects: vi.fn(async () => []),
  };
  return { flow: new ImportProjectFlow(), api };
}

it("建立→編輯→返回→再按主按鈕：重開原專案，不寫檔或重新配詞", async () => {
  const { flow, api } = await fixture();
  const first = await flow.open(source, request, api);
  if (!("session" in first)) throw new Error("Expected project");
  const path = first.session.projectPath;
  await updateProject(path, (project) => {
    project.timing.offsetMs = 1250;
    project.timing.texts = { "line-key": "修改歌詞" };
    project.style.size = 77;
    return project;
  });
  const before = await readFile(path, "utf8");
  const reopened = await flow.open(source, request, api);
  if (!("session" in reopened)) throw new Error("Expected project");
  expect(reopened.session.projectPath).toBe(path);
  expect(reopened.session.look.size).toBe(77);
  expect(reopened.session.timing.offsetMs).toBe(1250);
  expect(reopened.session.timing.texts).toEqual({ "line-key": "修改歌詞" });
  expect(await readFile(path, "utf8")).toBe(before);
  expect(api.saveFile).toHaveBeenCalledOnce();
  expect(api.matchProject).toHaveBeenCalledOnce();
  expect(api.resumeProject).toHaveBeenCalledWith(path);
  expect(api.downloadUrl).not.toHaveBeenCalled();
});

it("讀取已建專案失敗時不另建或初始化", async () => {
  const { flow, api } = await fixture();
  await flow.open(source, request, api);
  api.resumeProject.mockRejectedValueOnce(new Error("read failed"));
  await expect(flow.open(source, request, api)).rejects.toThrow("read failed");
  expect(api.saveFile).toHaveBeenCalledOnce();
  expect(api.matchProject).toHaveBeenCalledOnce();
});

it("首次配詞失敗後重試仍開啟已建檔案，連按不建立重複專案", async () => {
  const { flow, api } = await fixture();
  api.matchProject.mockRejectedValueOnce(new Error("match failed"));
  const first = flow.open(source, request, api);
  expect(flow.open(source, request, api)).toBe(first);
  await expect(first).rejects.toThrow("match failed");
  expect(flow.existingPath(source, request)).toBeTruthy();
  await flow.open(source, request, api);
  expect(api.saveFile).toHaveBeenCalledOnce();
  expect(api.resumeProject).toHaveBeenCalledOnce();
});

it("明確改匯入設定才另建，舊專案維持原內容", async () => {
  const { flow, api } = await fixture();
  const first = await flow.open(source, request, api);
  if (!("session" in first)) throw new Error("Expected project");
  const before = await readFile(first.session.projectPath, "utf8");
  const changed = { ...request, mode: "audio" as const };
  expect(flow.existingPath(source, changed)).toBeNull();
  const next = await flow.open(source, changed, api);
  if (!("session" in next)) throw new Error("Expected project");
  expect(next.session.projectPath).not.toBe(first.session.projectPath);
  expect(await readFile(first.session.projectPath, "utf8")).toBe(before);
  expect(api.saveFile).toHaveBeenCalledTimes(2);
});
