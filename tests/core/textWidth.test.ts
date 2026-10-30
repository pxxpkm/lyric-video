import { expect, it } from "vitest";
import { buildKaraokeAss } from "../../src/core/ass";
import { defaultLook, fitPercent, playWidth } from "../../src/core/lyricLook";
import { lineKey, lyricLine } from "../../src/core/lyrics";
import { horizontalFitPercent, measuredEm } from "../../src/core/textWidth";
import { karaokeAssDocument } from "../../src/main/exportVideo";
import { defaultTiming } from "../../src/core/timing";
import { timingForProject } from "../../src/core/projectTiming";

const english = "This is the life that I have been waiting for";

it("英文實際放得落時不再按全形字數壓窄", () => {
  expect(fitPercent(english.length, 64, 0, 6, .5, playWidth)).toBeLessThan(100);
  expect(horizontalFitPercent(english, 64, 0, 6, .5, 20)).toBe(100);
  const ass = buildKaraokeAss([lyricLine(1000, english)], undefined, defaultLook, [], [{ font: "chiron", text: english, em: 20 }]);
  expect(ass).not.toContain("\\fscx");
});

it("真正過長、移近邊及字距增加時仍收窄", () => {
  expect(horizontalFitPercent(english, 64, 0, 6, .5, 40)).toBeLessThan(100);
  expect(horizontalFitPercent(english, 64, 0, 6, .1, 20)).toBeLessThan(100);
  expect(horizontalFitPercent(english, 64, 8, 6, .5, 28)).toBeLessThan(100);
});

it("原文譯文按各自字體量度，MP4 與 ASS 共用資料，保留逐字時間", () => {
  const line = lyricLine(1000, english, { translatedText: english, words: [{ startMs: 0, durMs: 1000, text: english }] });
  const look = { ...defaultLook, transSize: 64, transFont: "kai" };
  const rows = [{ font: "chiron", text: english, em: 20 }, { font: "kai", text: english, em: 40 }];
  const ass = karaokeAssDocument({
    lines: [{ atMs: 1000, text: english, trans: english, words: line.words! }],
    timing: timingForProject(defaultTiming()), look, textMeasurements: rows,
  });
  expect(ass).toBe(buildKaraokeAss([line], undefined, look, [], rows));
  const orig = ass.split("\n").find(row => row.startsWith("Dialogue:") && row.includes(",Orig,"));
  const trans = ass.split("\n").find(row => row.startsWith("Dialogue:") && row.includes(",Trans,"));
  expect(orig).not.toContain("\\fscx");
  expect(orig).toContain("\\k");
  expect(trans).toContain(`\\fscx${horizontalFitPercent(english, 64, 0, 6, .5, 40)}`);
});

it("純中日文與直排沿用舊規則，缺量度或錯字體不套用另一份結果", () => {
  const text = "長".repeat(40);
  expect(horizontalFitPercent(text, 64, 0, 6, .5, 1)).toBe(fitPercent(40, 64, 0, 6, .5, playWidth));
  const line = lyricLine(1000, english);
  const rows = [{ font: "chiron", text: english, em: 20 }];
  expect(measuredEm(rows, english, "kai")).toBeUndefined();
  expect(horizontalFitPercent(english, 64, 0, 6, .5, NaN)).toBe(fitPercent(english.length, 64, 0, 6, .5, playWidth));
  const look = { ...defaultLook, flow: "vertical" as const };
  expect(buildKaraokeAss([line], undefined, look, [], rows)).toBe(buildKaraokeAss([line], undefined, look));
});

it("手改與插入英文使用最終文字的量度，放大仍保留等比進場", () => {
  const timing = { ...defaultTiming(), texts: { "1000|舊句": english }, added: [{ atMs: 5000, text: english, id: "new" }] };
  const line = lyricLine(1000, "舊句");
  const ass = buildKaraokeAss([line], timing, defaultLook, [{
    id: "scale", lineKey: lineKey(line), text: "舊句", startMs: 1000, endMs: 3000,
    enter: { x: 0, y: 0, opacity: 1 }, leave: { x: 0, y: 0, opacity: 1 },
    basis: "look", locked: true, preset: "scale",
  }], [{ font: "chiron", text: english, em: 20 }]);
  expect(ass).toContain("\\fscx82\\fscy82");
  expect(ass).toContain("\\fscx100\\fscy100");
  const added = ass.split("\n").find(row => row.startsWith("Dialogue: 0,0:00:05.00"));
  expect(added).not.toContain("\\fscx");
});
