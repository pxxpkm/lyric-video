import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../src/main/commandRunner", async (original) => ({
  ...await original<typeof import("../../src/main/commandRunner")>(), runCommand: vi.fn(),
}));
import { runCommand } from "../../src/main/commandRunner";
import { saveDownloaded } from "../../src/main/importService";
import { setRoots } from "../../src/main/paths";

const dirs: string[] = [];
afterEach(async () => {
  vi.resetAllMocks();
  setRoots({ studio: () => join(process.cwd(), "studio-data"), resources: () => process.cwd() });
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

it.each(["cancelled", "timeout"] as const)("下載 %s 不建立半成品專案，保留部分素材紀錄並可重試", async (reason) => {
  const root = await mkdtemp(join(tmpdir(), "lyric-tool-import-")); dirs.push(root);
  setRoots({ studio: () => root, resources: () => process.cwd() });
  let stop = true;
  vi.mocked(runCommand).mockImplementation(async (command, args) => {
    if (command === "ffprobe") return { code: 0, stdout: '{"format":{"duration":"10"}}', stderr: "" };
    const output = args[args.indexOf("-o") + 1].replace("%(ext)s", "mp4");
    if (stop) {
      await writeFile(`${output}.part`, "partial");
      return { code: -1, stdout: "", stderr: "", reason };
    }
    await writeFile(output, "complete test substitute");
    return { code: 0, stdout: `FILE:${output}\n`, stderr: "" };
  });
  const request = { title: "test", artist: "", durationMs: 10000, mode: "video" as const, lockTitle: false, lockArtist: false };
  const first = await saveDownloaded("https://test.invalid/media", request);
  expect(first.ok).toBe(false);
  if (!first.ok) expect(first.error).toContain(reason === "cancelled" ? "已取消" : "逾時");
  const files = await readdir(root, { recursive: true });
  expect(files.some(file => file.endsWith("project.json"))).toBe(false);
  expect(files.some(file => file.endsWith("download-files.json"))).toBe(true);
  stop = false;
  const second = await saveDownloaded("https://test.invalid/media", request);
  expect(second.ok).toBe(true);
  if (second.ok) {
    const project = JSON.parse(await readFile(second.projectPath, "utf8"));
    expect(project.source.mediaPath).toBe(second.mediaPath);
  }
});
