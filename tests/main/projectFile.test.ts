import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exampleProject } from "../../src/core/project";
import { ensureLogDir, logDir } from "../../src/main/log";
import { saveProject } from "../../src/main/projectFile";

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
