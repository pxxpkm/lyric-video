import { describe, expect, it } from "vitest";
import {
  applyEdits,
  clearShown,
  duplicateLine,
  formatShownLrc,
  lineDisplayEndMs,
  lineIsActive,
  lineKey,
  lyricLine,
  nextSungIndex,
  overlayFrozen,
  parseClipboardLyrics,
  parseLrc,
  parseTimingTags,
  parseYrcLines,
  placementMs,
  replaceShown,
  resolvedTranslation,
  restoreLyrics,
  setEffectiveTime,
  splitBilingual,
  splitMixedLyrics,
  timeOfMs,
  usableTrackDuration,
} from "../../src/core/lyrics";
import { defaultTiming, withAdded, withLineHold, withLineShift, withLineText, withLineTrans } from "../../src/core/timing";

const s = (seconds: number) => Math.round(seconds * 1000);

describe("歌詞解析與時機", () => {
  it("拆開同一句裡的日文和中文", () => {
    const { orig, trans } = splitBilingual("夕暮れ 駆け抜けた在黃昏中奔馳而過");
    expect(orig).toBe("夕暮れ 駆け抜けた");
    expect(trans).toBe("在黃昏中奔馳而過");
  });

  it("斜線分開的雙語", () => {
    const { orig, trans } = splitBilingual("きみの声 まだ残る / 你的聲音仍迴盪著");
    expect(orig).toBe("きみの声 まだ残る");
    expect(trans).toBe("你的聲音仍迴盪著");
  });

  it("同一時間的日文接中文配成譯文", () => {
    const lines = [
      lyricLine(s(12), "夕暮れ 駆け抜けた"),
      lyricLine(s(12), "在黃昏中奔馳而過"),
      lyricLine(s(15), "きみの声 まだ残る"),
    ];
    splitMixedLyrics(lines);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe("夕暮れ 駆け抜けた");
    expect(lines[0].translatedText).toBe("在黃昏中奔馳而過");
  });

  it("附近的中文行可以當譯文", () => {
    const jp = lyricLine(s(12), "夕暮れ 駆け抜けた");
    const cn = lyricLine(12_200, "在黃昏中奔馳而過");
    const lines = [jp, cn];
    expect(resolvedTranslation(lines, jp)).toBe("在黃昏中奔馳而過");
    expect(resolvedTranslation(lines, cn)).toBeNull();
  });

  it("逐字時間去掉後面的中文", () => {
    const line = lyricLine(s(1), "夕暮れ駆け抜けた在黃昏奔馳", {
      words: [
        { startMs: 0, durMs: 100, text: "夕" },
        { startMs: 100, durMs: 100, text: "暮" },
        { startMs: 200, durMs: 100, text: "れ" },
        { startMs: 300, durMs: 100, text: "駆" },
        { startMs: 400, durMs: 100, text: "け" },
        { startMs: 500, durMs: 100, text: "抜" },
        { startMs: 600, durMs: 100, text: "け" },
        { startMs: 700, durMs: 100, text: "た" },
        { startMs: 800, durMs: 100, text: "在" },
        { startMs: 900, durMs: 100, text: "黃" },
        { startMs: 1000, durMs: 100, text: "昏" },
        { startMs: 1100, durMs: 100, text: "奔" },
        { startMs: 1200, durMs: 100, text: "馳" },
      ],
    });
    const list = [line];
    splitMixedLyrics(list);
    expect(list[0].text).toBe("夕暮れ駆け抜けた");
    expect(list[0].translatedText).toBe("在黃昏奔馳");
    expect(list[0].words).toHaveLength(8);
    expect(list[0].words?.some((w) => w.text === "在" || w.text === "黃")).toBe(false);
  });

  it("YRC 絕對時間改成相對句首", () => {
    const lines = parseYrcLines("[14726,1200](14726,240,0)何(14966,240,0)か(15206,400,0)を");
    expect(lines).toHaveLength(1);
    expect(lines[0].startMs).toBe(14726);
    expect(lines[0].durMs).toBe(1200);
    expect(lines[0].words.map((w) => w.startMs)).toEqual([0, 240, 480]);
    expect(lines[0].words[0].text).toBe("何");
  });

  it("已經是相對時間的 YRC 保持相對", () => {
    const lines = parseYrcLines("[14726,1200](0,240,0)何(240,240,0)か(480,400,0)を");
    expect(lines[0].words.map((w) => w.startMs)).toEqual([0, 240, 480]);
  });

  it("標準 LRC", () => {
    const lines = parseLrc("[00:12.34]hello world\n[00:15.67]second line");
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe("hello world");
    expect(lines[0].timeMs).toBe(12340);
    expect(lines[1].text).toBe("second line");
  });

  it("三位毫秒", () => {
    const lines = parseLrc("[01:05.123]three digits\n[01:10.456]another");
    expect(lines[0].timeMs).toBe(65123);
  });

  it("空時間戳留作空檔", () => {
    const lines = parseLrc("[ti:Song Title]\n[ar:Artist]\n[00:05.00]\n[00:10.00]actual lyric\n[00:15.00]  ");
    expect(lines.map((l) => l.text)).toEqual(["", "actual lyric", ""]);
  });

  it("逐字唱完後的長空檔才收起", () => {
    const lines = [
      lyricLine(s(10), "verse end", {
        words: [
          { startMs: 0, durMs: 800, text: "verse" },
          { startMs: 800, durMs: 400, text: "end" },
        ],
      }),
      lyricLine(s(50), "next verse"),
    ];
    expect(lineIsActive(lines, 0, s(10.5))).toBe(true);
    expect(lineIsActive(lines, 0, s(24))).toBe(true);
    expect(lineIsActive(lines, 0, s(25))).toBe(false);
    expect(lineIsActive(lines, 1, s(50.2))).toBe(true);
  });

  it("中間的空時間戳不會切斷", () => {
    const lines = [lyricLine(s(5), "hello"), lyricLine(s(8), ""), lyricLine(s(12), "later")];
    expect(lineIsActive(lines, 0, s(9))).toBe(true);
    expect(lineDisplayEndMs(lines, 0)).toBe(s(12));
    expect(lineIsActive(lines, 1, s(9))).toBe(false);
  });

  it("連唱留到下一句", () => {
    const lines = [lyricLine(s(10), "a"), lyricLine(s(13), "b")];
    expect(lineDisplayEndMs(lines, 0)).toBe(s(13));
    expect(lineIsActive(lines, 0, s(12.5))).toBe(true);
  });

  it("拉長的連唱不會提早空白", () => {
    const lines = [lyricLine(s(10), "held"), lyricLine(s(20), "next")];
    expect(lineDisplayEndMs(lines, 0)).toBe(s(20));
    expect(lineIsActive(lines, 0, s(17))).toBe(true);
    expect(lineIsActive(lines, 1, s(17))).toBe(false);
    expect(lineIsActive(lines, 1, s(20.2))).toBe(true);
  });

  it("副歌空檔用預設停留", () => {
    const lines = [lyricLine(s(10), "verse end"), lyricLine(s(40), "chorus")];
    expect(lineIsActive(lines, 0, s(24))).toBe(true);
    expect(lineIsActive(lines, 0, s(25))).toBe(false);
    expect(lineIsActive(lines, 1, s(25))).toBe(false);
  });

  it("稍後的中文戳不切斷最後一句副歌", () => {
    const lines = [
      lyricLine(s(10), "最後のサビ"),
      lyricLine(s(12), "最後副歌"),
      lyricLine(s(40), "次のAメロ"),
    ];
    expect(nextSungIndex(lines, 0)).toBe(2);
    expect(lineIsActive(lines, 1, s(12.5))).toBe(false);
    expect(lineIsActive(lines, 0, s(12.5))).toBe(true);
    expect(lineIsActive(lines, 0, s(16.5))).toBe(true);
    expect(resolvedTranslation(lines, lines[0])).toBe("最後副歌");
  });

  it("停留可以超過下一句", () => {
    const lines = [lyricLine(s(10), "held"), lyricLine(s(13), "next")];
    const holds = { [lineKey(lines[0])]: 4000 };
    expect(lineDisplayEndMs(lines, 0, null, holds)).toBe(s(17));
    expect(lineIsActive(lines, 0, s(15), null, holds)).toBe(true);
    expect(lineIsActive(lines, 1, s(15), null, holds)).toBe(false);
    expect(lineIsActive(lines, 1, s(17.2), null, holds)).toBe(true);
  });

  it("停留加長空檔", () => {
    const lines = [lyricLine(s(10), "end"), lyricLine(s(50), "later")];
    const holds = { [lineKey(lines[0])]: 3000 };
    expect(lineIsActive(lines, 0, s(27), null, holds)).toBe(true);
    expect(lineIsActive(lines, 0, s(28), null, holds)).toBe(false);
  });

  it("逐字唱完或沒有逐字就凍結", () => {
    expect(overlayFrozen(null, 0)).toBe(true);
    expect(overlayFrozen([], 9000)).toBe(true);
    const words = [
      { startMs: 0, durMs: 400, text: "a" },
      { startMs: 400, durMs: 500, text: "b" },
    ];
    expect(overlayFrozen(words, 100)).toBe(false);
    expect(overlayFrozen(words, 899)).toBe(false);
    expect(overlayFrozen(words, 900)).toBe(true);
    expect(overlayFrozen(words, 14_500)).toBe(true);
  });

  it("改詞、藏句、插入", () => {
    const src = [
      lyricLine(s(1), "studio", { words: [{ startMs: 0, durMs: 200, text: "studio" }] }),
      lyricLine(s(2), "skip me"),
      lyricLine(s(4), "keep"),
    ];
    const timing = withAdded(
      withLineText(withLineText(defaultTiming(), lineKey(src[0]), "live words"), lineKey(src[1]), ""),
      { atMs: 2500, text: "ad-lib", id: "ab12" },
    );
    const shown = applyEdits(src, timing);
    expect(shown.map((l) => l.text)).toEqual(["live words", "ad-lib", "keep"]);
    expect(shown[0].sourceKey).toBe(lineKey(src[0]));
    expect(lineKey(shown[1])).toBe("add|ab12");
    expect(shown[0].words).toBeNull();
  });

  it("沒改的譯文留著，空字串則藏起", () => {
    const src = lyricLine(s(1), "夕暮れ", { translatedText: "黃昏" });
    const key = lineKey(src);
    expect(applyEdits([src], defaultTiming())[0].translatedText).toBe("黃昏");
    expect(applyEdits([src], withLineTrans(defaultTiming(), key, ""))[0].translatedText).toBeNull();
    expect(applyEdits([src], withLineTrans(defaultTiming(), key, "黃昏啊"))[0].translatedText).toBe("黃昏啊");
  });

  it("匯入歌詞不會疊在原來的上面", () => {
    const src = [lyricLine(s(1), "studio", { translatedText: "錄音室" }), lyricLine(s(2), "keep")];
    let t = replaceShown({ ...defaultTiming(), offsetMs: 800, rate: 1.03 }, src, [
      { atMs: 1000, text: "live", trans: "現場", holdMs: 0 },
      { atMs: 2000, text: "hey", trans: null, holdMs: 0 },
    ]);
    expect(t.offsetMs).toBe(800);
    expect(t.rate).toBeCloseTo(1.03, 3);
    let shown = applyEdits(src, t);
    expect(shown.map((l) => l.text)).toEqual(["live", "hey"]);
    expect(shown[0].translatedText).toBe("現場");
    t = replaceShown(t, src, [{ atMs: 3000, text: "once", trans: null, holdMs: 0 }]);
    shown = applyEdits(src, t);
    expect(shown.map((l) => l.text)).toEqual(["once"]);
  });

  it("還原保留時鐘，清空則畫面空白", () => {
    const src = [lyricLine(s(1), "hello")];
    const t = withAdded(withLineShift({ ...defaultTiming(), offsetMs: 500, rate: 1.02 }, lineKey(src[0]), 100), {
      atMs: 2000,
      text: "extra",
      id: "x1",
    });
    const cleared = clearShown(t, src);
    expect(applyEdits(src, cleared)).toEqual([]);
    expect(cleared.offsetMs).toBe(500);
    const restored = restoreLyrics(t);
    const shown = applyEdits(src, restored);
    expect(shown.map((l) => l.text)).toEqual(["hello"]);
    expect(restored.offsetMs).toBe(500);
    expect(restored.rate).toBeCloseTo(1.02, 3);
    expect(restored.added).toBeNull();
    expect(restored.lines).toBeNull();
  });

  it("新位置取兩句中間", () => {
    expect(placementMs(s(10), s(13), 0)).toBe(11_500);
    expect(placementMs(s(13), null, 0)).toBe(14_000);
    expect(placementMs(null, s(10), 0)).toBe(9_500);
  });

  it("改有效時間：原句用偏移，插入句改時間", () => {
    const orig = lyricLine(s(10), "hello");
    let t = setEffectiveTime(defaultTiming(), orig, 12_000);
    expect(t.lines?.[lineKey(orig)]).toBe(2000);
    expect(timeOfMs(orig, t.lines)).toBe(s(12));

    const added = lyricLine(s(5), "ad", { sourceKey: "add|ab" });
    t = setEffectiveTime(withAdded(defaultTiming(), { atMs: 5_000, text: "ad", id: "ab" }), added, 8_000);
    expect(t.added?.[0].atMs).toBe(8_000);
    expect(t.lines == null || Object.keys(t.lines).length === 0).toBe(true);
  });

  it("複製一句", () => {
    const line = lyricLine(s(10), "chorus");
    const t = duplicateLine(defaultTiming(), line, 15_000);
    expect(t.added).toHaveLength(1);
    expect(t.added?.[0].text).toBe("chorus");
    expect(t.added?.[0].atMs).toBe(15_000);
    const shown = applyEdits([line], t);
    expect(shown[1].text).toBe("chorus");
    expect(shown[1].timeMs).toBe(s(15));
  });

  it("複製時帶上中文", () => {
    const line = lyricLine(s(10), "夕暮れ", { translatedText: "黃昏" });
    const t = duplicateLine(defaultTiming(), line, 20_000);
    expect(t.added?.[0].trans).toBe("黃昏");
    expect(applyEdits([line], t)[1].translatedText).toBe("黃昏");
  });

  it("純文字和 LRC 都可以貼上", () => {
    const plain = parseClipboardLyrics("hello\nworld", 3_000);
    expect(plain.map((c) => [c.atMs, c.text])).toEqual([
      [3000, "hello"],
      [4000, "world"],
    ]);
    const lrc = parseClipboardLyrics("[00:10.00]a\n[00:12.50]b", 0);
    expect(lrc.map((c) => [c.atMs, c.text])).toEqual([
      [10_000, "a"],
      [12_500, "b"],
    ]);
  });

  it("貼上時日文接中文當譯文", () => {
    const lrc = parseClipboardLyrics(
      "[00:10.00]夕暮れ 駆け抜けた\n[00:10.00]在黃昏中奔馳而過\n[00:15.00]きみの声\n[00:15.00]你的聲音",
      0,
    );
    expect(lrc).toHaveLength(2);
    expect(lrc[0].trans).toBe("在黃昏中奔馳而過");
    expect(lrc[1].trans).toBe("你的聲音");
    const plain = parseClipboardLyrics("きみの声\n你的聲音", 1000);
    expect(plain).toHaveLength(1);
    expect(plain[0].text).toBe("きみの声");
    expect(plain[0].trans).toBe("你的聲音");
  });

  it("匯出 LRC 用有效時間", () => {
    const line = lyricLine(s(10), "hello");
    const text = formatShownLrc([line], { ...defaultTiming(), lines: { [lineKey(line)]: 1500 } }, false);
    expect(text).toContain("[0:11.50]hello");
  });

  it("譯文寫在同一個時間戳", () => {
    const line = lyricLine(s(12), "夕暮れ 駆け抜けた", { translatedText: "在黃昏中奔馳而過" });
    expect(formatShownLrc([line], defaultTiming(), false).replaceAll("\r\n", "\n")).toBe(
      "[0:12.00]夕暮れ 駆け抜けた\n[0:12.00]在黃昏中奔馳而過\n",
    );
  });

  it("匯出偏移和快慢", () => {
    const text = formatShownLrc([lyricLine(s(10), "hello")], { ...defaultTiming(), offsetMs: 2000, rate: 1.03 });
    expect(text).toContain("[offset:2000]");
    expect(text).toContain("[dl_rate:1.030]");
    expect(text).toContain("[0:10.00]hello");
  });

  it("停留可以寫出再讀回", () => {
    const line = lyricLine(s(10), "held");
    const text = formatShownLrc([line], withLineHold(defaultTiming(), lineKey(line), 2500));
    expect(text).toContain("[dl_hold:2500]");
    const clips = parseClipboardLyrics(text, 0);
    expect(clips[0].holdMs).toBe(2500);
    const src = [lyricLine(s(1), "old")];
    const imported = replaceShown(defaultTiming(), src, clips);
    expect(Object.values(imported.holds ?? {})).toContain(2500);
    const shown = applyEdits(src, imported);
    expect(lineDisplayEndMs(shown, 0, imported.lines, imported.holds)).toBe(s(27));
  });

  it("讀取偏移標籤並在換詞後保留", () => {
    const raw = "[offset:-1500]\n[dl_rate:1.015]\n[00:10.00]きみの声\n[00:10.00]你的聲音\n";
    const tags = parseTimingTags(raw);
    expect(tags.offsetMs).toBe(-1500);
    expect(tags.rate).toBeCloseTo(1.015, 3);
    const clips = parseClipboardLyrics(raw, 0);
    const src = [lyricLine(s(1), "old")];
    const t = replaceShown(defaultTiming(), src, clips, tags.offsetMs, tags.rate);
    expect(t.offsetMs).toBe(-1500);
    expect(t.rate).toBeCloseTo(1.015, 3);
    const shown = applyEdits(src, t);
    expect(shown).toHaveLength(1);
    expect(shown[0].text).toBe("きみの声");
    expect(shown[0].translatedText).toBe("你的聲音");
    expect(shown[0].timeMs).toBe(s(10));
  });

  it("依時間排序", () => {
    const lines = parseLrc("[00:30.00]late\n[00:05.00]early\n[00:15.00]middle");
    expect(lines.map((l) => l.text)).toEqual(["early", "middle", "late"]);
  });

  it("長片的時長不用來對歌詞", () => {
    expect(usableTrackDuration(2 * 60 * 60 * 1000)).toBeNull();
    expect(usableTrackDuration(4 * 60 * 1000)).toBe(4 * 60 * 1000);
    expect(usableTrackDuration(8_000)).toBeNull();
  });
});
