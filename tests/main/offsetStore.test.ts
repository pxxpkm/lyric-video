import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { lyricLine, timeOfMs } from "../../src/core/lyrics";
import {
  FAST_STEP_MS,
  HOLD_ACCEL_MS,
  HOLD_DELAY_MS,
  HOLD_FAST_MS,
  MAX_MS,
  MEDIUM_STEP_MS,
  STEP_MS,
  defaultTiming,
  formatOffset,
  isIdentity,
  stepForHoldMs,
  withAdded,
  withLineHold,
  withLineShift,
  withLineText,
  withLineTrans,
  withoutLine,
} from "../../src/core/timing";
import { OffsetStore } from "../../src/main/offsetStore";
import { installProjectDict } from "../installDict";

const dump =
  "TVアニメ「とある科学の超電磁砲」後期OP映像（ LEVEL5 -judgelight-／ fripSide）【NBCユニバーサルAnime✕Music30周年記念OP/ED毎日投稿企画】";

beforeAll(installProjectDict);

describe("時機記憶", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function store(): OffsetStore {
    const dir = mkdtempSync(join(tmpdir(), "lyric-offset-"));
    dirs.push(dir);
    return new OffsetStore(join(dir, "offsets.json"));
  }

  it("記住偏移", () => {
    const s = store();
    s.setMs("七里香", "周杰倫", 200);
    expect(s.getMs("七里香", "周杰倫")).toBe(200);
  });

  it("零會清掉", () => {
    const s = store();
    s.setMs("七里香", "周杰倫", 200);
    s.setMs("七里香", "周杰倫", 0);
    expect(s.getMs("七里香", "周杰倫")).toBe(0);
  });

  it("長標題和抽出的歌名共用偏移", () => {
    const s = store();
    s.setMs(dump, "NBCUNIVERSAL ANIME/MUSIC", -150);
    expect(s.getMs(dump, "NBCUNIVERSAL ANIME/MUSIC")).toBe(-150);
    expect(s.getMs("LEVEL5 -judgelight-", "fripSide")).toBe(-150);
  });

  it("微調會累加並夾住", () => {
    const s = store();
    expect(s.nudge("a", "b", 50)).toBe(50);
    expect(s.nudge("a", "b", 50)).toBe(100);
    expect(s.nudge("a", "b", 999_000)).toBe(MAX_MS);
  });

  it("可以超過十秒", () => {
    const s = store();
    s.setMs("a", "b", 15_000);
    expect(s.getMs("a", "b")).toBe(15_000);
    s.setMs("a", "b", -90_000);
    expect(s.getMs("a", "b")).toBe(-90_000);
  });

  it("按住時步進加快", () => {
    expect(stepForHoldMs(0)).toBe(0);
    expect(stepForHoldMs(HOLD_DELAY_MS - 1)).toBe(0);
    expect(stepForHoldMs(HOLD_DELAY_MS)).toBe(STEP_MS);
    expect(stepForHoldMs(HOLD_ACCEL_MS)).toBe(MEDIUM_STEP_MS);
    expect(stepForHoldMs(HOLD_FAST_MS)).toBe(FAST_STEP_MS);
  });

  it("快慢和偏移一起記住", () => {
    const s = store();
    s.setTiming("live", "yt", { ...defaultTiming(), offsetMs: 1500, rate: 1.03 });
    const t = s.getTiming("live", "yt");
    expect(t.offsetMs).toBe(1500);
    expect(t.rate).toBeCloseTo(1.03, 3);
  });

  it("只改偏移時保留快慢", () => {
    const s = store();
    s.setTiming("a", "b", { ...defaultTiming(), offsetMs: 100, rate: 1.04 });
    s.setMs("a", "b", 200);
    const t = s.getTiming("a", "b");
    expect(t.offsetMs).toBe(200);
    expect(t.rate).toBeCloseTo(1.04, 3);
  });

  it("舊的整數檔會轉成偏移", () => {
    const dir = mkdtempSync(join(tmpdir(), "lyric-offset-"));
    dirs.push(dir);
    const path = join(dir, "offsets.json");
    writeFileSync(path, `{"bob|song":250}`);
    const s = new OffsetStore(path);
    expect(s.getMs("song", "bob")).toBe(250);
    expect(s.getTiming("song", "bob").rate).toBe(1);
  });

  it("記住逐句偏移", () => {
    const s = store();
    s.setTiming("live", "yt", withLineShift(defaultTiming(), "1000|hello", 400));
    const got = s.getTiming("live", "yt");
    expect(got.lines?.["1000|hello"]).toBe(400);
    expect(timeOfMs(lyricLine(1000, "hello"), got.lines)).toBe(1400);
  });

  it("記住停留和改詞", () => {
    const s = store();
    const key = "1000|hello";
    s.setTiming("live", "yt", withLineText(withLineHold(defaultTiming(), key, 2500), key, "live hello"));
    const got = s.getTiming("live", "yt");
    expect(got.holds?.[key]).toBe(2500);
    expect(got.texts?.[key]).toBe("live hello");
  });

  it("記住插入句", () => {
    const s = store();
    s.setTiming("live", "yt", withAdded(defaultTiming(), { atMs: 12_000, text: "hey", id: "x1" }));
    const got = s.getTiming("live", "yt");
    expect(got.added).toHaveLength(1);
    expect(got.added?.[0]).toMatchObject({ atMs: 12_000, text: "hey", id: "x1" });
  });

  it("記住譯文和插入句的譯文", () => {
    const s = store();
    const key = "1000|hello";
    s.setTiming(
      "live",
      "yt",
      withAdded(withLineTrans(defaultTiming(), key, "你好"), { atMs: 2000, text: "hey", id: "z1", trans: "嘿" }),
    );
    const got = s.getTiming("live", "yt");
    expect(got.trans?.[key]).toBe("你好");
    expect(got.added?.[0].trans).toBe("嘿");
  });

  it("去掉一句會清掉偏移、停留和改詞", () => {
    const key = "1000|hello";
    const t = withoutLine(
      withLineTrans(withLineText(withLineHold(withLineShift(defaultTiming(), key, 400), key, 2000), key, "x"), key, "中文"),
      key,
    );
    expect(isIdentity(t)).toBe(true);
  });

  it("偏移顯示成秒", () => {
    expect(formatOffset(0)).toBe("±0.00s");
    expect(formatOffset(200)).toBe("+0.20s");
    expect(formatOffset(-50)).toBe("−0.05s");
    expect(formatOffset(15_500)).toBe("+15.50s");
    expect(formatOffset(-90_000)).toBe("−90.00s");
  });
});
