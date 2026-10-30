import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exampleProject } from "../../src/core/project";
import { ensureLogDir, logDir } from "../../src/main/log";
import { saveProject, updateProject, waitProjectWrites } from "../../src/main/projectFile";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lyric-video-"));
  dirs.push(dir);
  return dir;
}

describe("saveProject", () => {
  it("十次並行保存全部成功，最後提交版本落盤且無暫存碰撞", async () => {
    const dir = await tempDir();
    const path = join(dir, "project.json");
    await Promise.all(Array.from({ length: 10 }, (_, index) => {
      const project = exampleProject();
      project.identity.title = `版本${index}`;
      return saveProject(path, project);
    }));
    await waitProjectWrites(path);
    expect(JSON.parse(await readFile(path, "utf8")).identity.title).toBe("版本9");
    expect(await readdir(dir)).toEqual(["project.json"]);
  });

  it("同專案讀改寫排序，不同欄位更新不會互相蓋掉", async () => {
    const dir = await tempDir();
    const path = join(dir, "project.json");
    await saveProject(path, exampleProject());
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const first = updateProject(path, async (project) => {
      await gate;
      project.identity.title = "新歌名";
      return project;
    });
    const second = updateProject(path, (project) => {
      project.timing.offsetMs = 1250;
      return project;
    });
    const otherPath = join(dir, "other.json");
    await saveProject(otherPath, exampleProject());
    release();
    await Promise.all([first, second]);
    const saved = JSON.parse(await readFile(path, "utf8"));
    expect(saved.identity.title).toBe("新歌名");
    expect(saved.timing.offsetMs).toBe(1250);
  });

  it("更新失敗後原檔有效，後續更新仍可完成", async () => {
    const path = join(await tempDir(), "project.json");
    await saveProject(path, exampleProject());
    const failed = updateProject(path, () => { throw new Error("failed"); });
    const retry = updateProject(path, (project) => { project.identity.title = "重試成功"; return project; });
    await expect(failed).rejects.toThrow("failed");
    await retry;
    expect(JSON.parse(await readFile(path, "utf8")).identity.title).toBe("重試成功");
  });
  it("寫壞的內容不會覆蓋原來的檔", async () => {
    const dir = await tempDir();
    const path = join(dir, "project.json");
    const good = exampleProject();
    good.identity.title = "原來的歌";
    await saveProject(path, good);

    const broken = { ...exampleProject(), version: 2 };
    await expect(saveProject(path, broken)).rejects.toThrow();

    const still = JSON.parse(await readFile(path, "utf8")) as { identity: { title: string } };
    expect(still.identity.title).toBe("原來的歌");
  });

  it("合法內容會換成新檔，不留下暫存", async () => {
    const dir = await tempDir();
    const path = join(dir, "nested", "project.json");
    const first = exampleProject();
    first.identity.title = "第一首";
    await saveProject(path, first);

    const second = exampleProject();
    second.identity.title = "第二首";
    await saveProject(path, second);

    const saved = JSON.parse(await readFile(path, "utf8")) as { identity: { title: string } };
    expect(saved.identity.title).toBe("第二首");
    await expect(readFile(`${path}.${process.pid}.tmp`, "utf8")).rejects.toThrow();
  });
});

describe("logDir", () => {
  it("放在 LyricVideoStudio，不會碰到 DesktopLyric", async () => {
    const dir = await tempDir();
    expect(logDir(dir)).toBe(join(dir, "LyricVideoStudio"));
    expect(logDir(dir).toLowerCase()).not.toContain("desktoplyric");
    await expect(ensureLogDir(dir)).resolves.toBe(join(dir, "LyricVideoStudio"));
  });
});
