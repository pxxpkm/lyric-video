import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { extractParenArtist, extractParenSong, searchArtist, searchTitle } from "../../src/core/title";
import { ChoiceStore } from "../../src/main/choiceStore";
import { installProjectDict } from "../installDict";

const railgun =
  "TVアニメ「とある科学の超電磁砲」後期OP映像（ LEVEL5 -judgelight-／ fripSide）【NBCユニバーサルAnime✕Music30周年記念OP/ED毎日投稿企画】";

beforeAll(installProjectDict);

describe("歌名清理", () => {
  it("抽出引號裡的歌名，並剝掉 Topic", () => {
    expect(searchTitle("fhána「星をあつめて」（劇場版『SHIROBAKO』主題歌）MUSIC VIDEO")).toBe("星をあつめて");
    expect(searchTitle("大原ゆい子「ユビオリ」 Live Ver.")).toBe("ユビオリ");
    expect(searchArtist("雪に咲く花", "Kana Hanazawa - Topic")).toBe("Kana Hanazawa");
  });

  it("從動漫 OP 標題抽出歌名和歌手", () => {
    expect(extractParenSong(railgun)).toBe("level5-judgelight-");
    expect(extractParenArtist(railgun)).toBe("fripside");
    expect(searchTitle(railgun)).toBe("level5-judgelight- TVサイズ");
    expect(searchArtist(railgun, "NBCUNIVERSAL ANIME/MUSIC")).toBe("fripside");
  });
});

describe("記住揀過的版本", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function store(): ChoiceStore {
    const dir = mkdtempSync(join(tmpdir(), "lyric-choice-"));
    dirs.push(dir);
    return new ChoiceStore(join(dir, "choices.json"));
  }

  it("記住精確選擇", () => {
    const s = store();
    s.set("七里香", "周杰倫", "ncm:1");
    expect(s.get("七里香", "周杰倫")).toBe("ncm:1");
  });

  it("簡體和繁體共用", () => {
    const s = store();
    s.set("爱", "周杰伦", "ncm:2");
    expect(s.get("愛", "周杰倫")).toBe("ncm:2");
  });

  it("歌手空著時，歌名唯一就找得到", () => {
    const s = store();
    s.set("コントラスト", "hatsuboshi gakuen - topic", "ncm:3");
    expect(s.get("コントラスト", "")).toBe("ncm:3");
    expect(s.get("コントラスト", "hatsuboshi gakuen")).toBe("ncm:3");
  });

  it("剝掉曲號和 Topic", () => {
    const s = store();
    s.set("01. 花痕 -shirushi- (hanaato -shirushi-)", "calico calico - topic", "ncm:4");
    expect(s.get("花痕 -shirushi-", "calico calico")).toBe("ncm:4");
  });

  it("同名歌要靠歌手分開", () => {
    const s = store();
    s.set("同名", "A", "ncm:a");
    s.set("同名", "B", "ncm:b");
    expect(s.get("同名", "A")).toBe("ncm:a");
    expect(s.get("同名", "B")).toBe("ncm:b");
    expect(s.get("同名", "")).toBeNull();
    expect(s.get("同名", "C")).toBeNull();
  });

  it("不同頻道但歌名唯一仍對到", () => {
    const s = store();
    s.set("level5 -judgelight-", "nbcuniversal anime/music", "ncm:5");
    expect(s.get("level5-judgelight-", "fripside")).toBe("ncm:5");
  });

  it("YouTube 長標題記住的是裡面那首歌", () => {
    const s = store();
    s.set(railgun, "NBCUNIVERSAL ANIME/MUSIC", "ncm:676207");
    expect(s.get(railgun, "NBCUNIVERSAL ANIME/MUSIC")).toBe("ncm:676207");
    expect(s.get(railgun, "")).toBe("ncm:676207");
    expect(s.get("LEVEL5 -judgelight-", "fripSide")).toBe("ncm:676207");
    expect(s.get("LEVEL5 -judgelight-", "NBCUniversal Anime✕Music")).toBe("ncm:676207");
  });

  it("舊檔裡的短 key 也能從長標題找到", () => {
    const dir = mkdtempSync(join(tmpdir(), "lyric-choice-"));
    dirs.push(dir);
    const path = join(dir, "choices.json");
    writeFileSync(
      path,
      `{
        "nbcuniversal anime|tvアニメ「とある科学の超電磁砲」後期op映像": "ncm:676207",
        "|level5 -judgelight-": "ncm:676207"
      }`,
    );
    const s = new ChoiceStore(path);
    expect(s.get(railgun, "NBCUNIVERSAL ANIME/MUSIC")).toBe("ncm:676207");
    expect(s.get(railgun, "fripSide")).toBe("ncm:676207");
    expect(s.get("LEVEL5 -judgelight-", "")).toBe("ncm:676207");
  });

  it("清單把同一候選的別名合成一筆", () => {
    const s = store();
    s.set(railgun, "NBCUNIVERSAL ANIME/MUSIC", "ncm:676207");
    s.set("七里香", "周杰倫", "ncm:1");
    const list = s.listAll();
    expect(list).toHaveLength(2);
    const hit = list.find((c) => c.candidateKey === "ncm:676207");
    expect(hit?.title.toLowerCase()).toContain("judgelight");
    expect(hit?.sourceLabel).toBe("網易雲");
    expect((hit?.keys.length ?? 0) >= 2).toBe(true);
  });

  it("刪掉候選會清掉所有別名", () => {
    const s = store();
    s.set(railgun, "NBCUNIVERSAL ANIME/MUSIC", "ncm:676207");
    expect(s.removeCandidate("ncm:676207")).toBe(true);
    expect(s.get("LEVEL5 -judgelight-", "fripSide")).toBeNull();
    expect(s.listAll()).toEqual([]);
  });

  it("再揀一次會換掉重疊的舊候選", () => {
    const s = store();
    s.set(railgun, "NBCUNIVERSAL ANIME/MUSIC", "ncm:676207");
    s.set(railgun, "NBCUNIVERSAL ANIME/MUSIC", "ncm:tv-size");
    expect(s.get(railgun, "NBCUNIVERSAL ANIME/MUSIC")).toBe("ncm:tv-size");
    expect(s.get("LEVEL5 -judgelight-", "fripSide")).toBe("ncm:tv-size");
    expect(s.listAll().some((c) => c.candidateKey === "ncm:676207")).toBe(false);
    expect(s.listAll()).toHaveLength(1);
    expect(s.listAll()[0].candidateKey).toBe("ncm:tv-size");
  });

  it("改指向會搬移所有別名", () => {
    const s = store();
    s.set(railgun, "NBCUNIVERSAL ANIME/MUSIC", "ncm:676207");
    s.retarget("ncm:676207", "ncm:999");
    expect(s.get(railgun, "NBCUNIVERSAL ANIME/MUSIC")).toBe("ncm:999");
    expect(s.get("LEVEL5 -judgelight-", "fripSide")).toBe("ncm:999");
    expect(s.listAll()).toHaveLength(1);
    expect(s.listAll()[0].candidateKey).toBe("ncm:999");
  });
});
