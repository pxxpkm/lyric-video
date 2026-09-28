import { describe, expect, it } from "vitest";
import { buildKaraokeAss } from "../../src/core/ass";
import { assColor, assFontSize, clampLook, defaultLook, lyricFont, moveLook } from "../../src/core/lyricLook";
import { exampleProject, parseProject } from "../../src/core/project";
import { testClipLines } from "../../src/core/preview";

describe("字體", () => {
  it("預設靠下、有裙邊、不是純白", () => {
    expect(defaultLook.y).toBeGreaterThan(0.7);
    expect(defaultLook.outline).toBeGreaterThan(0);
    expect(defaultLook.color.toLowerCase()).not.toBe("#ffffff");
    expect(defaultLook.color.toLowerCase()).not.toBe("#f3f5f8");
    expect(lyricFont("ChironGoRoundTC").id).toBe("chiron");
  });

  it("拖拉和越界會夾在畫面裡", () => {
    const moved = moveLook(defaultLook, 0.1, -0.2);
    expect(moved.x).toBeCloseTo(0.6);
    expect(moved.y).toBeCloseTo(0.62);
    expect(clampLook({ ...defaultLook, x: 4, y: -1, size: 9, outline: 40 }).x).toBe(0.96);
  });

  it("舊專案沒有這些欄位也補得上", () => {
    const raw = exampleProject();
    const parsed = parseProject({
      ...raw,
      style: { showTrans: true, karaoke: true, font: "ChironGoRoundTC" },
    });
    expect(parsed.style.y).toBe(defaultLook.y);
    expect(parsed.style.outline).toBe(defaultLook.outline);
    expect(parsed.style.font).toBe("ChironGoRoundTC");
  });

  it("匯出字幕用同一個位置、字級和裙邊", () => {
    const look = { ...defaultLook, x: 0.5, y: 0.8, size: 40, outline: 4 };
    const ass = buildKaraokeAss(testClipLines(), undefined, look);
    expect(ass).toContain("\\pos(960,864)");
    expect(ass).toContain("\\bord4");
    expect(ass).toContain(`\\fs${assFontSize(40, "chiron")}`);
    expect(assFontSize(64, "chiron")).toBe(205);
    expect(assFontSize(64, "kai")).toBe(80);
    expect(ass).toContain(assColor(look.outlineColor));
    expect(ass).toContain("Chiron GoRound TC");
  });
});
