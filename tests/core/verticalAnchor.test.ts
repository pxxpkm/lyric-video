import { expect, it } from "vitest";
import { buildKaraokeAss } from "../../src/core/ass";
import { defaultLook, clampLook, columnGlyphY, fitPercent, verticalFitPercent } from "../../src/core/lyricLook";
import { lyricLine, lineKey } from "../../src/core/lyrics";
import { defaultTiming } from "../../src/core/timing";
import { exampleProject, parseProject } from "../../src/core/project";
import { setLinePreset } from "../../src/core/motion";

it("長短直排句的第一字位置固定，後續只向下排", () => {
  const look = { ...defaultLook, flow: "vertical" as const, verticalAnchor: "first" as const, x: .3, y: .2 };
  const ass = buildKaraokeAss([lyricLine(1000, "甲乙"), lyricLine(5000, "天地玄黃宇宙洪荒")], undefined, look);
  const rows = ass.split("\n").filter((row) => row.startsWith("Dialogue:"));
  expect(rows.find((row) => row.endsWith("甲"))).toContain("\\pos(576,216)");
  expect(rows.find((row) => row.endsWith("天"))).toContain("\\pos(576,216)");
  const coords = rows.filter((row) => row.startsWith("Dialogue: 0,0:00:05.00,")).map((row) => Number(row.match(/\\pos\(\d+,(\d+)\)/)?.[1]));
  expect(coords.every((y, i) => i === 0 || y > coords[i - 1])).toBe(true);
  expect(columnGlyphY(216, 20, 50, 0, "first")).toBe(216);
});

it.each(["horizontal", "vertical"] as const)("隱藏原文在 %s 匯出不產生原文或原文裝飾，保留編輯後譯文", (flow) => {
  const line = lyricLine(1000, "原文", { translatedText: "舊譯" });
  const timing = defaultTiming();
  timing.trans = { [lineKey(line)]: "新譯" };
  const clips = setLinePreset([], lineKey(line), line.text, 1000, 5000, "dust");
  const ass = buildKaraokeAss([line], timing, { ...defaultLook, flow, y: .2, transY: .2, showOriginal: false }, clips);
  const events = ass.split("\n").filter((row) => row.startsWith("Dialogue:"));
  expect(events.length).toBeGreaterThan(0);
  expect(events.every((row) => row.includes(",Trans,"))).toBe(true);
  expect(events.join("\n")).not.toContain("原文");
  expect(events.some((row) => row.includes("新"))).toBe(true);
});

it("新專案設定可保存，舊專案缺欄位仍用中央定位及顯示原文", () => {
  const fresh = exampleProject();
  expect(fresh.style.verticalAnchor).toBe("first");
  const { verticalAnchor: _anchor, showOriginal: _show, ...legacyStyle } = fresh.style;
  const old = parseProject({ ...fresh, style: { ...legacyStyle, flow: "vertical" } });
  expect(clampLook(old.style).verticalAnchor).toBe("center");
  expect(old.style.showOriginal).toBe(true);
  const saved = parseProject({ ...fresh, style: { ...fresh.style, showOriginal: false, verticalAnchor: "first" } });
  expect(saved.style.showOriginal).toBe(false);
  expect(clampLook(saved.style).verticalAnchor).toBe("first");
});

it("句首靠上時長句只用下方空間收窄，不會被中央定位限制誤縮", () => {
  expect(fitPercent(8, 64, 0, 6, .15, 1080, "first")).toBe(100);
  expect(verticalFitPercent(8, 64, 0, 6, .15, 1080, "chiron", -2, "first")).toBe(100);
  expect(verticalFitPercent(30, 64, 0, 6, .15, 1080, "chiron", -2, "first")).toBeLessThan(100);
});
