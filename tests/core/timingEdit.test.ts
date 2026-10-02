import { describe, expect, it } from "vitest";
import { applyEdits, lineDisplayEndMs, lineKey, timeOfMs } from "../../src/core/lyrics";
import { lyricClockMs, mediaMsForLyric, previewFrame, testClipLines, undoTiming } from "../../src/core/preview";
import { exampleProject, parseProject } from "../../src/core/project";
import { timingForProject, timingFromProject } from "../../src/core/projectTiming";
import { defaultTiming, hideLine, repeatAdjustment, sameTiming, withAdded, withLineHold, withLineShift, withoutLine } from "../../src/core/timing";

describe("時機", () => {
  it("整首偏移和快慢改歌詞時鐘", () => {
    expect(lyricClockMs(1_000, 50, 1)).toBe(950);
    expect(lyricClockMs(1_000, 0, 1.01)).toBeCloseTo(1_010, 5);
    expect(mediaMsForLyric(1_000, 50, 1)).toBe(1_050);
  });

  it("整體延遲會改每一句在列表上的時間", () => {
    const line = testClipLines()[0];
    expect(Math.round(mediaMsForLyric(timeOfMs(line, null), 50, 1))).toBe(1_050);
    expect(Math.round(mediaMsForLyric(timeOfMs(line, null), -50, 1))).toBe(950);
  });

  it("把第一句撥早 50ms 後，980ms 就顯示", () => {
    const timing = withLineShift(defaultTiming(), "1000|第一句", -50);
    const shown = applyEdits(testClipLines(), timing);
    expect(timeOfMs(shown[0], timing.lines)).toBe(950);
    expect(previewFrame(shown, 980, timing).text).toBe("第一句");
    expect(previewFrame(shown, 980).text).toBe("");
  });

  it("按住加減會重複，毫秒類之後加快", () => {
    expect(repeatAdjustment("ms", 0, true, 1)).toBe(50);
    expect(repeatAdjustment("ms", 200, false, 1)).toBe(0);
    expect(repeatAdjustment("ms", 1_300, false, -1)).toBe(-250);
    expect(repeatAdjustment("stay", 1_300, false, 1)).toBe(250);
    expect(repeatAdjustment("rate", 1_300, false, 1)).toBeCloseTo(0.005, 5);
  });

  it("停留會拉長這句的顯示", () => {
    const timing = withLineHold(defaultTiming(), "6000|第三句", 250);
    const shown = applyEdits(testClipLines(), timing);
    expect(lineDisplayEndMs(shown, 2, timing.lines, timing.holds)).toBe(6_000 + 14_500 + 250);
  });

  it("復原回到撥之前", () => {
    const start = defaultTiming();
    const shifted = withLineShift(start, "1000|第一句", -50);
    const undone = undoTiming([start], shifted);
    expect(undone.past).toEqual([]);
    expect(undone.current.lines).toBeNull();
  });

  it("刪除原句會藏起，刪除插入句會拿走，上一步拎返", () => {
    const src = testClipLines();
    const key = lineKey(src[0]);
    const shifted = withLineShift(defaultTiming(), key, -50);
    const hidden = hideLine(shifted, key);
    expect(hidden.lines?.[key]).toBe(-50);
    expect(hidden.texts?.[key]).toBe("");
    expect(applyEdits(src, hidden).map((line) => line.text)).not.toContain("第一句");
    expect(sameTiming(hidden, hideLine(hidden, key))).toBe(true);
    const back = undoTiming([shifted], hidden);
    expect(back.past).toEqual([]);
    expect(applyEdits(src, back.current).map((line) => line.text)).toContain("第一句");
    expect(applyEdits(src, withoutLine(hidden, key))[0].text).toBe("第一句");

    const added = withAdded(defaultTiming(), { atMs: 2500, text: "加句", id: "ab12" });
    const removed = hideLine(added, "add|ab12");
    expect(removed.added).toBeNull();
    expect(applyEdits(src, removed).some((line) => line.text === "加句")).toBe(false);
    const restored = undoTiming([added], removed);
    expect(applyEdits(src, restored.current).some((line) => line.text === "加句")).toBe(true);
  });

  it("到頂再加唔算改過", () => {
    const maxed = withLineShift(defaultTiming(), "1000|第一句", 300_000);
    const again = withLineShift(maxed, "1000|第一句", 300_050);
    expect(sameTiming(maxed, again)).toBe(true);
  });

  it("寫進專案再讀出，50ms 還在", () => {
    const timing = withLineShift(defaultTiming(), "1000|第一句", -50);
    const project = exampleProject();
    project.timing = timingForProject(timing);
    const again = timingFromProject(parseProject(project).timing);
    expect(again.lines?.["1000|第一句"]).toBe(-50);
  });
});
