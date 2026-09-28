import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { projectFromImport } from "../../src/core/importPlan";
import { browseProject, isTestClipProject, matchProject, useCandidate } from "../../src/main/matchLyrics";
import { ChoiceStore } from "../../src/main/choiceStore";
import { neteaseSearchCall, searchSources, type LyricCall, type LyricFetch } from "../../src/main/lyricRemote";
import { saveProject } from "../../src/main/projectFile";
import { installProjectDict } from "../installDict";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const fixture = (name: string) => readFileSync(join(root, "fixtures/lyrics", name), "utf8");
const dirs: string[] = [];

beforeAll(installProjectDict);

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lyric-video-"));
  dirs.push(dir);
  return dir;
}

function ok(body: string) {
  return { ok: true, status: 200, body };
}

function routed(fail: (call: LyricCall) => boolean = () => false): LyricFetch {
  return async (call) => {
    if (fail(call) || call.url.includes("/api/search/get")) return { ok: false, status: 500, body: "" };
    if (call.url.includes("/api/cloudsearch/pc")) return ok(fixture("netease-search.json"));
    if (call.url.includes("/api/song/lyric")) return ok(fixture("netease-lyric.json"));
    if (call.body?.includes("DoSearchForQQMusicDesktop")) return ok(fixture("qq-search.json"));
    if (call.body?.includes("GetPlayLyricInfo")) return ok(fixture("qq-lyric.json"));
    if (call.url.includes("mobilecdn.kugou.com")) return ok(fixture("kugou-search.json"));
    if (call.url.includes("lyrics.kugou.com/search")) return ok(JSON.stringify({ candidates: [{ id: "1", accesskey: "ak" }] }));
    if (call.url.includes("lyrics.kugou.com/download")) return ok(fixture("kugou-lyric.json"));
    if (call.url.includes("lrclib.net/api/search")) return ok(fixture("lrclib-search.json"));
    if (call.url.includes("lrclib.net/api/get/")) return ok(fixture("lrclib-lyric.json"));
    return { ok: false, status: 404, body: "" };
  };
}

async function project(dir: string, durationMs: number, title = "七里香", artist = "周杰倫") {
  const path = join(dir, "project.json");
  await saveProject(
    path,
    projectFromImport({
      kind: "file",
      url: "",
      mediaPath: join(dir, "song.mp3"),
      title,
      artist,
      durationMs,
      mode: "audio",
      lockTitle: false,
      lockArtist: false,
    }),
  );
  return path;
}

describe("歌詞請求", () => {
  it("網易雲用 cloudsearch，不用舊的 search/get", () => {
    const call = neteaseSearchCall("七里香", "周杰倫");
    expect(call.url).toBe("https://music.163.com/api/cloudsearch/pc");
    expect(call.url.includes("/api/search/get")).toBe(false);
    expect(call.body).toContain("type=1");
  });

  it("一家失敗，其他家仍有結果", async () => {
    const found = await searchSources(
      "七里香",
      "周杰倫",
      routed((call) => call.url.includes("cloudsearch")),
    );
    expect(found.map((item) => item.source)).toEqual(["QQ", "酷狗", "LRCLIB"]);
  });
});

describe("配上歌詞", () => {
  it("只有一個夠自信的結果就寫進預覽", async () => {
    const dir = await tempDir();
    const path = await project(dir, 269_000);
    const choices = new ChoiceStore(join(dir, "choices.json"));
    const fetch = routed((call) => !call.url.includes("cloudsearch") && !call.url.includes("/api/song/lyric"));
    const found = await matchProject(path, { fetch, choices });
    expect(found.kind).toBe("preview");
    if (found.kind !== "preview") return;
    expect(found.session.lines[0]?.text).toBe("窗外的麻雀");
    expect(found.session.lines[0]?.trans).toBe("sparrow on the wire");
  });

  it("四個來源太接近就打開選擇歌詞，使用後才寫入", async () => {
    const dir = await tempDir();
    const path = await project(dir, 269_000);
    const choices = new ChoiceStore(join(dir, "choices.json"));
    const found = await matchProject(path, { fetch: routed(), choices });
    expect(found.kind).toBe("pick");
    if (found.kind !== "pick") return;
    expect(found.pick.hits.length).toBeGreaterThan(1);
    const used = await useCandidate(path, "qq:0039MnYb0qxYhV", true, { fetch: routed(), choices });
    expect("kind" in used && used.kind === "preview").toBe(true);
    if (!("kind" in used) || used.kind !== "preview") return;
    expect(used.session.lines[0]?.text).toBe("窗外的麻雀");
    expect(choices.get("七里香", "周杰倫")).toBe("qq:0039MnYb0qxYhV");
  });

  it("長片不自動採用", async () => {
    const dir = await tempDir();
    const path = await project(dir, 20 * 60_000);
    const choices = new ChoiceStore(join(dir, "choices.json"));
    const fetch = routed((call) => !call.url.includes("cloudsearch") && !call.url.includes("/api/song/lyric"));
    const found = await matchProject(path, { fetch, choices });
    expect(found.kind).toBe("pick");
    if (found.kind !== "pick") return;
    expect(found.pick.reason).toBe("長片");
    expect(found.session.lines).toEqual([]);
  });

  it("記住過的版本直接用", async () => {
    const dir = await tempDir();
    const path = await project(dir, 20 * 60_000);
    const choices = new ChoiceStore(join(dir, "choices.json"));
    choices.set("七里香", "周杰倫", "lrc:42");
    const found = await matchProject(path, { fetch: routed(), choices });
    expect(found.kind).toBe("preview");
    if (found.kind !== "preview") return;
    expect(found.session.lines[0]?.text).toBe("窗外的麻雀");
  });

  it("測試片不連網", async () => {
    const dir = await tempDir();
    const folder = join(dir, "test-clip");
    const path = join(folder, "project.json");
    await saveProject(
      path,
      projectFromImport({
        kind: "file",
        url: "",
        mediaPath: join(folder, "source.wav"),
        title: "測試片",
        artist: "",
        durationMs: 10_000,
        mode: "audio",
        lockTitle: false,
        lockArtist: false,
      }),
    );
    let called = false;
    const fetch: LyricFetch = async () => {
      called = true;
      return { ok: false, status: 500, body: "" };
    };
    const found = await matchProject(path, { fetch, choices: new ChoiceStore(join(dir, "choices.json")) });
    expect(isTestClipProject(path)).toBe(true);
    expect(called).toBe(false);
    expect(found.kind).toBe("preview");
  });

  it("再搜只列出結果，不先寫進專案", async () => {
    const dir = await tempDir();
    const path = await project(dir, 269_000);
    const choices = new ChoiceStore(join(dir, "choices.json"));
    const found = await browseProject(path, { title: "七里香", artist: "周杰倫", lockTitle: true, lockArtist: false }, {
      fetch: routed(),
      choices,
    });
    expect(found.kind).toBe("pick");
    if (found.kind !== "pick") return;
    expect(found.session.lines).toEqual([]);
    expect(found.pick.hits.length).toBeGreaterThan(0);
  });
});
