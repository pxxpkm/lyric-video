import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { candidate } from "../../src/core/candidate";
import {
  linesHaveWords,
  parseKugouLyric,
  parseLrcLibLyric,
  parseLrcLibSearch,
  parseNeteaseLyric,
  parseNeteaseSearch,
  parseQqLyric,
  parseQqSearch,
  parseKugouSearch,
} from "../../src/core/providers";
import { decide } from "../../src/core/score";
import { collectCandidates } from "../../src/core/search";
import { installProjectDict } from "../installDict";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const fixture = (name: string) => JSON.parse(readFileSync(join(root, "fixtures/lyrics", name), "utf8"));

beforeAll(installProjectDict);

const query = { title: "七里香", artist: "周杰倫", durationMs: 269_000 };

describe("錄好的歌詞回應", () => {
  it("四個搜尋形狀都讀得出七里香", () => {
    expect(parseNeteaseSearch(fixture("netease-search.json"))[0]).toMatchObject({
      key: "ncm:186016",
      source: "網易雲",
      title: "七里香",
      artist: "周杰倫",
      durationMs: 271_000,
    });
    expect(parseQqSearch(fixture("qq-search.json"))[0]).toMatchObject({
      key: "qq:0039MnYb0qxYhV",
      durationMs: 271_000,
    });
    expect(parseKugouSearch(fixture("kugou-search.json"))[0]).toMatchObject({
      key: "kg:6C6A4F5E0A0B4C0D",
      durationMs: 271_000,
    });
    const lrclib = parseLrcLibSearch(fixture("lrclib-search.json"));
    expect(lrclib).toHaveLength(1);
    expect(lrclib[0]).toMatchObject({ key: "lrc:42", durationMs: 271_200 });
  });

  it("網易雲歌詞帶逐字和譯文，純音樂則沒有", () => {
    const lines = parseNeteaseLyric(fixture("netease-lyric.json"));
    expect(lines?.[0].text).toBe("窗外的麻雀");
    expect(lines?.[0].translatedText).toBe("sparrow on the wire");
    expect(linesHaveWords(lines)).toBe(true);
    expect(parseNeteaseLyric({ lrc: { lyric: "[00:01.00]纯音乐，请欣赏" } })).toBeNull();
  });

  it("QQ、酷狗、LRCLIB 的歌詞正文", () => {
    expect(parseQqLyric(fixture("qq-lyric.json"))?.[0].text).toBe("窗外的麻雀");
    expect(parseQqLyric(fixture("qq-lyric.json"))?.[0].translatedText).toBe("sparrow");
    expect(parseKugouLyric(fixture("kugou-lyric.json"))?.[0].text).toBe("sparrow");
    expect(parseLrcLibLyric(fixture("lrclib-lyric.json"))?.[0].text).toBe("窗外的麻雀");
  });
});

describe("自動採用", () => {
  const netease = candidate({
    key: "ncm:186016",
    source: "網易雲",
    title: "七里香",
    artist: "周杰倫",
    durationMs: 271_000,
    hasWords: true,
  });
  const other = candidate({
    key: "lrc:9",
    source: "LRCLIB",
    title: "七里香",
    artist: "別的人",
    durationMs: 200_000,
  });

  it("歌名、歌手、時長都近，而且拉開第二名，就採用", () => {
    const decision = decide({ ...query, candidates: [other, netease] });
    expect(decision.accept).toBe(true);
    expect(decision.reason).toBe("自動採用");
    expect(decision.candidate?.key).toBe("ncm:186016");
    expect(decision.ranked[0].score).toBeCloseTo(1.0767, 3);
    expect(decision.ranked[1].score).toBeCloseTo(0.56, 3);
  });

  it("歌名不像就拒絕", () => {
    const wrong = candidate({
      key: "ncm:1",
      source: "網易雲",
      title: "晴天",
      artist: "周杰倫",
      durationMs: 269_000,
    });
    const decision = decide({ ...query, candidates: [wrong] });
    expect(decision.accept).toBe(false);
    expect(decision.reason).toBe("歌名不像");
    expect(decision.ranked[0].score).toBeCloseTo(0.49, 3);
  });

  it("長片不自動採用", () => {
    const decision = decide({ ...query, durationMs: 20 * 60_000, candidates: [netease] });
    expect(decision.accept).toBe(false);
    expect(decision.reason).toBe("長片");
  });

  it("兩個分數太接近就不猜", () => {
    const qq = candidate({
      key: "qq:1",
      source: "QQ",
      title: "七里香",
      artist: "周杰倫",
      durationMs: 269_000,
    });
    const same = candidate({ ...netease, hasWords: false, durationMs: 269_000 });
    const decision = decide({ ...query, candidates: [same, qq] });
    expect(decision.accept).toBe(false);
    expect(decision.reason).toBe("太接近");
  });

  it("記住過的版本直接用", () => {
    const decision = decide({
      ...query,
      durationMs: 20 * 60_000,
      candidates: [other],
      rememberedKey: "lrc:9",
    });
    expect(decision.accept).toBe(true);
    expect(decision.reason).toBe("已記住");
    expect(decision.candidate?.key).toBe("lrc:9");
  });
});

describe("來源失敗", () => {
  it("一家拋錯，其他家仍有結果", async () => {
    const found = await collectCandidates(
      [
        { search: async () => { throw new Error("網易雲掛了"); } },
        { search: async () => parseQqSearch(fixture("qq-search.json")) },
      ],
      "七里香",
      "周杰倫",
    );
    expect(found.map((item) => item.key)).toEqual(["qq:0039MnYb0qxYhV"]);
  });

  it("逾時的來源當沒有結果", async () => {
    const found = await collectCandidates(
      [
        { search: () => new Promise(() => undefined) },
        { search: async () => parseKugouSearch(fixture("kugou-search.json")) },
      ],
      "七里香",
      "周杰倫",
      20,
    );
    expect(found.map((item) => item.key)).toEqual(["kg:6C6A4F5E0A0B4C0D"]);
  });
});
