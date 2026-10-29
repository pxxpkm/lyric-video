import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findCachedMedia, youtubeId } from "../../src/main/mediaCache";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });
const url = "https://www.youtube.com/watch?v=BFSmN6fQ_04";

it.each([
  url, "https://youtu.be/BFSmN6fQ_04?t=12", "https://music.youtube.com/watch?v=BFSmN6fQ_04&list=abc",
  "https://youtube.com/shorts/BFSmN6fQ_04", "https://youtube.com/live/BFSmN6fQ_04",
])("同一影片 ID：%s", (input) => expect(youtubeId(input)).toBe("BFSmN6fQ_04"));

it.each(["invalid", "https://youtube.com.example.com/watch?v=BFSmN6fQ_04", "https://youtube.com/watch?v=bad", "ftp://youtu.be/BFSmN6fQ_04"])("不接受其他來源：%s", (input) => expect(youtubeId(input)).toBeNull());

async function fixture(mode = "video", suffix = "webm", content = "media") {
  const root = await mkdtemp(join(tmpdir(), "lyric-cache-"));
  roots.push(root);
  const folder = join(root, "yt-old");
  await mkdir(folder);
  const path = join(folder, `source.${suffix}`);
  await writeFile(path, content);
  await writeFile(join(folder, "project.json"), JSON.stringify({ source: { kind: "youtube", url, mode, mediaPath: path } }));
  return { root, path, folder };
}

it("重用舊專案來源，短連結亦命中", async () => {
  const { root, path } = await fixture();
  const probe = vi.fn().mockResolvedValue(217000);
  expect(await findCachedMedia(root, "https://youtu.be/BFSmN6fQ_04", "video", probe)).toEqual({ mediaPath: path, durationMs: 217000 });
  expect(probe).toHaveBeenCalledWith(path);
});

it("不同模式或不同影片不重用", async () => {
  const { root } = await fixture("audio");
  const probe = vi.fn();
  expect(await findCachedMedia(root, url, "video", probe)).toBeNull();
  expect(await findCachedMedia(root, "https://youtu.be/abcdefghijk", "audio", probe)).toBeNull();
  expect(probe).not.toHaveBeenCalled();
});

it.each(["missing", "empty", "part", "broken", "project"])("失效素材回退下載：%s", async (kind) => {
  const { root, path, folder } = await fixture("video", kind === "part" ? "part" : "webm", kind === "empty" ? "" : "media");
  if (kind === "missing") await rm(path);
  if (kind === "project") await writeFile(join(folder, "project.json"), "broken json");
  expect(await findCachedMedia(root, url, "video", vi.fn().mockResolvedValue(null))).toBeNull();
});
