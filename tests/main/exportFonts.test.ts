import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultTiming } from "../../src/core/timing";
import { timingForProject } from "../../src/core/projectTiming";
import { assFontsDirPlan, ensureExportFonts, karaokeAssDocument, saveAssFile } from "../../src/main/exportVideo";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lyric-video-"));
  dirs.push(dir);
  return dir;
}

describe("輸出 ASS", () => {
  it("寫去揀定的路徑，內容同燒進影片的字幕", async () => {
    const dir = await tempDir();
    const request = {
      lines: [{ atMs: 1000, text: "第一句", trans: "譯", words: [] }],
      timing: timingForProject(defaultTiming()),
      motion: [],
    };
    const text = karaokeAssDocument(request);
    expect(text).toContain("第一句");
    const saved = await saveAssFile(join(dir, "歌"), request);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.outPath.endsWith(`${join(dir, "歌")}.ass`)).toBe(true);
    expect(await readFile(saved.outPath, "utf8")).toBe(text);
  });
});

describe("assFontsDirPlan", () => {
  it("開發時字體在專案裡，濾鏡用沒有空格的相對路徑", () => {
    const clip = "C:\\Users\\Leo\\Lyric Video\\studio-data\\test-clip";
    const fonts = "C:\\Users\\Leo\\Lyric Video\\fonts";
    expect(assFontsDirPlan(clip, fonts)).toEqual({ token: "../../fonts", copyTo: null });
  });

  it("打包後字體路徑含空格，改複製到專案資料旁再引用", () => {
    const clip = "C:\\Users\\Leo\\AppData\\Roaming\\lyric-video\\studio-data\\test-clip";
    const fonts = "C:\\Users\\Leo\\Lyric Video\\release\\win-unpacked\\resources\\fonts";
    const plan = assFontsDirPlan(clip, fonts);
    expect(plan.token).toBe("../../export-fonts");
    expect(plan.copyTo).toBe(resolve(clip, "..", "..", "export-fonts"));
    expect(plan.token).toMatch(/^[A-Za-z0-9._/-]+$/);
  });
});

describe("ensureExportFonts", () => {
  it("複製缺少的字體，大小和時間沒變就不再複製", async () => {
    const dir = await tempDir();
    const from = join(dir, "from");
    const to = join(dir, "to");
    await mkdir(from, { recursive: true });
    await writeFile(join(from, "ChironGoRoundTC-Regular.ttf"), "font-a");
    await ensureExportFonts(from, to);
    expect(await readFile(join(to, "ChironGoRoundTC-Regular.ttf"), "utf8")).toBe("font-a");

    const dest = join(to, "ChironGoRoundTC-Regular.ttf");
    const first = await stat(dest);
    const older = new Date(first.mtimeMs - 10_000);
    await utimes(join(from, "ChironGoRoundTC-Regular.ttf"), older, older);
    await ensureExportFonts(from, to);
    expect((await stat(dest)).mtimeMs).toBe(first.mtimeMs);

    await writeFile(join(from, "ChironGoRoundTC-Regular.ttf"), "font-bb");
    await ensureExportFonts(from, to);
    expect(await readFile(join(to, "ChironGoRoundTC-Regular.ttf"), "utf8")).toBe("font-bb");
  });
});

