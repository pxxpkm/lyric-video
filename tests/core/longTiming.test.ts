import { expect, it } from "vitest";
import { buildKaraokeAss } from "../../src/core/ass";
import { applyEdits, duplicateLine, lineKey, lyricLine, setEffectiveTime, timeOfMs } from "../../src/core/lyrics";
import { mediaMsForLyric, previewFrame } from "../../src/core/preview";
import { exampleProject, parseProject } from "../../src/core/project";
import { timingForProject, timingFromProject } from "../../src/core/projectTiming";
import { clamped, defaultTiming, MAX_MS, withAdded, withLineShift } from "../../src/core/timing";

it.each([299_999, 300_000, 300_001, 360_000, 780_000])("插入句保留絕對時間 %i，預覽及 ASS 不截回五分鐘", (atMs) => {
  const timing = withAdded(defaultTiming(), { atMs, id: "long", text: "長片新增句" });
  const shown = applyEdits([], timing);
  expect(shown[0].timeMs).toBe(atMs);
  expect(previewFrame(shown, atMs - 1, timing).text).toBe("");
  expect(previewFrame(shown, atMs, timing).text).toBe("長片新增句");
  const ass = buildKaraokeAss([], timing);
  const start = ass.split("\n").find((line) => line.startsWith("Dialogue:"))?.split(",")[1];
  const rounded = Math.round(atMs / 10);
  const expected = `${Math.floor(rounded / 360000)}:${String(Math.floor(rounded / 6000) % 60).padStart(2, "0")}:${String(Math.floor(rounded / 100) % 60).padStart(2, "0")}.${String(rounded % 100).padStart(2, "0")}`;
  expect(start).toBe(expected);
});

it("六分鐘的原句及新增句都可再調 50ms", () => {
  const original = lyricLine(360_000, "原句");
  const originalTiming = setEffectiveTime(defaultTiming(), original, 360_050);
  expect(originalTiming.lines?.[lineKey(original)]).toBe(50);
  expect(timeOfMs(original, originalTiming.lines)).toBe(360_050);

  const timing = withLineShift(withAdded(defaultTiming(), { atMs: 360_000, id: "long", text: "新增句" }), "add|long", 100);
  const added = applyEdits([], timing)[0];
  const moved = setEffectiveTime(timing, added, 360_150);
  expect(moved.added?.[0].atMs).toBe(360_150);
  expect(moved.lines?.["add|long"] ?? 0).toBe(0);
  expect(timeOfMs(applyEdits([], moved)[0], moved.lines)).toBe(360_150);
});

it("複製至六分鐘及專案保存重載，保留文字、譯文及時間", () => {
  const src = lyricLine(10_000, "副歌", { translatedText: "chorus" });
  const timing = duplicateLine(defaultTiming(), src, 360_000);
  const project = exampleProject();
  project.timing = timingForProject(timing);
  const restored = timingFromProject(parseProject(JSON.parse(JSON.stringify(project))).timing);
  const shown = applyEdits([src], restored);
  expect(shown[1]).toMatchObject({ timeMs: 360_000, text: "副歌", translatedText: "chorus" });
  expect(buildKaraokeAss([src], restored)).toContain("Dialogue: 0,0:06:00.00,");
});

it("長片絕對時間不改整首及逐句偏移限制，延遲和速度繼續換算", () => {
  const timing = clamped(withLineShift({ ...withAdded(defaultTiming(), { atMs: 780_000, id: "long", text: "長片" }), offsetMs: 900_000 }, "add|long", 900_000));
  expect(timing.offsetMs).toBe(MAX_MS);
  expect(timing.lines?.["add|long"]).toBe(MAX_MS);
  expect(timing.added?.[0].atMs).toBe(780_000);
  expect(mediaMsForLyric(360_000, 2000, 1.2)).toBe(302_000);
  expect(applyEdits([], withAdded(defaultTiming(), { atMs: -50, id: "negative", text: "句" }))[0].timeMs).toBe(0);
});
