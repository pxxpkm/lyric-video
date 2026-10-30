import { link, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { assertExportDestination, publishExport } from "../../src/main/exportFile";
import { exportProject, type ExportRequest } from "../../src/main/exportVideo";
import { defaultTiming } from "../../src/core/timing";
import { timingForProject } from "../../src/core/projectTiming";
import { runCommand } from "../../src/main/media";
import { cancelToolOperation, runToolOperation } from "../../src/main/toolOperations";

vi.mock("../../src/main/media", () => ({ runCommand: vi.fn() }));
const dirs: string[] = [];
afterEach(async () => {
  vi.resetAllMocks();
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "lyric-export-safety-"));
  dirs.push(dir);
  const mediaPath = join(dir, "source.mp4");
  const outPath = join(dir, "song.mp4");
  await writeFile(mediaPath, "source");
  await writeFile(outPath, "old");
  const request: ExportRequest = {
    projectPath: join(dir, "project.json"), mediaPath, outPath,
    mode: "video", durationMs: 10000,
    lines: [{ atMs: 1000, text: "測試", trans: "", words: [] }],
    timing: timingForProject(defaultTiming()),
  };
  return { dir, mediaPath, outPath, request };
}

it("拒絕同一路徑及硬連結來源，未啟動轉碼或寫字幕", async () => {
  const f = await fixture();
  expect((await exportProject({ ...f.request, outPath: f.mediaPath }, f.dir, () => {})).ok).toBe(false);
  const alias = join(f.dir, "alias.mp4");
  await link(f.mediaPath, alias);
  await expect(assertExportDestination(f.mediaPath, alias)).rejects.toThrow("來源影音");
  expect(runCommand).not.toHaveBeenCalled();
  expect(await readdir(f.dir)).not.toContain("karaoke.ass");
  expect(await readFile(f.mediaPath, "utf8")).toBe("source");
});

it("成功換入新成片，來源不變", async () => {
  const f = await fixture();
  vi.mocked(runCommand).mockImplementation(async (_cmd, args) => {
    await writeFile(args[args.length - 1], "new");
    return { code: 0, stdout: "", stderr: "" };
  });
  expect((await exportProject(f.request, f.dir, () => {})).ok).toBe(true);
  expect(await readFile(f.outPath, "utf8")).toBe("new");
  expect(await readFile(f.mediaPath, "utf8")).toBe("source");
});

it("轉碼失敗清理本次暫存，舊成片保持", async () => {
  const f = await fixture();
  vi.mocked(runCommand).mockImplementation(async (_cmd, args) => {
    await writeFile(args[args.length - 1], "incomplete");
    return { code: 1, stdout: "", stderr: "failed" };
  });
  expect((await exportProject(f.request, f.dir, () => {})).ok).toBe(false);
  expect(await readFile(f.outPath, "utf8")).toBe("old");
  expect((await readdir(f.dir)).filter((name) => name.endsWith(".part.mp4"))).toEqual([]);
});

it("rename 失敗保留舊成片", async () => {
  const f = await fixture();
  await expect(publishExport(join(f.dir, "missing.part.mp4"), f.outPath, f.mediaPath)).rejects.toThrow();
  expect(await readFile(f.outPath, "utf8")).toBe("old");
});

it("取消後即使工具回報成功亦不替換舊片，清本次暫存並可重試", async () => {
  const f = await fixture();
  let attempt = 0;
  vi.mocked(runCommand).mockImplementation(async (_cmd, args) => {
    await writeFile(args[args.length - 1], "new");
    if (attempt++ === 0) cancelToolOperation("export:test");
    return { code: 0, stdout: "", stderr: "" };
  });
  const result = await runToolOperation("export:test", () => exportProject(f.request, f.dir, () => {}));
  expect(result.ok).toBe(false);
  expect(await readFile(f.outPath, "utf8")).toBe("old");
  expect((await readdir(f.dir)).filter(name => name.endsWith(".part.mp4"))).toEqual([]);
  expect((await runToolOperation("export:test", () => exportProject(f.request, f.dir, () => {}))).ok).toBe(true);
});

it("轉碼期間目的改為來源硬連結，拒絕換入並保留新成片；重試使用新暫存", async () => {
  const f = await fixture();
  const parts: string[] = [];
  vi.mocked(runCommand).mockImplementation(async (_cmd, args) => {
    const part = args[args.length - 1];
    parts.push(part);
    await writeFile(part, "new");
    if (parts.length === 1) {
      await rm(f.outPath);
      await link(f.mediaPath, f.outPath);
    }
    return { code: 0, stdout: "", stderr: "" };
  });
  const first = await exportProject(f.request, f.dir, () => {});
  expect(first.ok).toBe(false);
  if (!first.ok) expect(first.error).toContain(parts[0]);
  expect(await readFile(parts[0], "utf8")).toBe("new");
  expect(await readFile(f.mediaPath, "utf8")).toBe("source");
  await rm(f.outPath);
  expect((await exportProject(f.request, f.dir, () => {})).ok).toBe(true);
  expect(parts[0]).not.toBe(parts[1]);
  expect(await readFile(parts[0], "utf8")).toBe("new");
});
