import { describe, expect, it } from "vitest";
import { buildKaraokeAss } from "../../src/core/ass";
import {
  assColor,
  assFontSize,
  canvasFont,
  clampLook,
  defaultLook,
  fitPercent,
  fitUsed,
  fitWidthTag,
  frameRoom,
  isVerticalFlow,
  lineInk,
  lyricFont,
  moveLook,
  playHeight,
  playWidth,
  softBlur,
  softBlurMax,
} from "../../src/core/lyricLook";
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
    expect(moved.transX).toBeCloseTo(defaultLook.transX + 0.1);
    expect(moved.transY).toBeCloseTo(defaultLook.transY - 0.2);
    expect(clampLook({ ...defaultLook, x: 4, y: -1, transX: -2, size: 9, outline: 40 }).x).toBe(1);
    expect(clampLook({ ...defaultLook, transX: 4 }).transX).toBe(1);
    expect(clampLook({ ...defaultLook, x: -1 }).x).toBe(0);
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
    expect(parsed.style.flow).toBe("horizontal");
    expect(parsed.style.transX).toBeCloseTo(defaultLook.x);
    expect(parsed.style.transY).toBeCloseTo(defaultLook.y + (defaultLook.size * 1.25) / 1080);
    expect(parsed.style.transSize).toBe(defaultLook.transSize);
    expect(parsed.style.transColor).toBe(defaultLook.color);
    expect(parsed.style.tracking).toBe(0);
    expect(parsed.style.soft).toBe(false);
    expect(parsed.style.softBlur).toBe(0);
    expect(parsed.style.transFont).toBe(lyricFont(parsed.style.font).id);
    expect(defaultLook.soft).toBe(false);
    expect(defaultLook.softBlur).toBe(0);
    expect(defaultLook.outline).toBe(6);
    expect(clampLook({ soft: true }).softBlur).toBe(softBlur);
    expect(clampLook({ soft: true }).soft).toBe(true);
    expect(clampLook({ soft: true, softBlur: 0 }).soft).toBe(false);
    expect(clampLook({ softBlur: 2.5 }).softBlur).toBe(2.5);
    expect(clampLook({ softBlur: 9 }).softBlur).toBe(softBlurMax);
    const { softBlur: stored, ...opened } = raw.style;
    expect(stored).toBe(0);
    expect(parseProject({ ...raw, style: { ...opened, soft: true } }).style.softBlur).toBe(softBlur);
    expect(parseProject({ ...raw, style: { ...raw.style, softBlur: 0, soft: true } }).style).toMatchObject({ soft: false, softBlur: 0 });
    expect(parseProject({ ...raw, style: { ...raw.style, tracking: 4 } }).style.tracking).toBe(4);
    expect(defaultLook.tracking).toBe(0);
    expect(clampLook({ ...defaultLook, tracking: 4 }).tracking).toBe(4);
    expect(clampLook({ ...defaultLook, tracking: 4.6 }).tracking).toBe(5);
    expect(clampLook({ ...defaultLook, tracking: 9 }).tracking).toBe(8);
    expect(clampLook({ ...defaultLook, tracking: -2 }).tracking).toBe(0);
  });

  it("舊檔的譯文比例換成字級，已分開的字級同顏色保持", () => {
    const raw = exampleProject();
    const { transSize: _size, transColor: _color, ...style } = raw.style;
    const migrated = parseProject({
      ...raw,
      style: { ...style, size: 80, transScale: 0.5, color: "#112233" },
    });
    expect(migrated.style.transSize).toBe(40);
    expect(migrated.style.transColor).toBe("#112233");
    const kept = parseProject({
      ...raw,
      style: { ...raw.style, size: 100, transSize: 90, transColor: "#ABCDEF", transScale: 0.4 },
    });
    expect(kept.style.transSize).toBe(90);
    expect(kept.style.transColor).toBe("#ABCDEF");
    expect(clampLook({ ...defaultLook, size: 100 }).transSize).toBe(defaultLook.transSize);
    expect(clampLook({ size: 80, transScale: 0.5 }).transSize).toBe(40);
    expect(clampLook({ color: "#ABCDEF" }).transColor).toBe("#ABCDEF");
    expect(clampLook({ color: "#ABCDEF", transColor: "#123456" }).transColor).toBe("#123456");
    expect(clampLook({ ...defaultLook, transSize: 200 }).transSize).toBe(120);
    expect(clampLook({ ...defaultLook, transSize: 4 }).transSize).toBe(24);
  });

  it("揀垂直只改排列，位置留喺原處", () => {
    const upright = clampLook({ ...defaultLook, flow: "vertical" });
    expect(upright.flow).toBe("vertical");
    expect(upright.x).toBeCloseTo(defaultLook.x);
    expect(upright.y).toBeCloseTo(defaultLook.y);
    const legacy = clampLook({ ...defaultLook, flow: ("left" as string) as "vertical" });
    expect(legacy.flow).toBe("vertical");
    expect(legacy.x).toBeCloseTo(defaultLook.x);
    expect(legacy.y).toBeCloseTo(defaultLook.y);
    expect(isVerticalFlow("left")).toBe(true);
    expect(isVerticalFlow("right")).toBe(true);
    expect(isVerticalFlow("horizontal")).toBe(false);
  });

  it("舊的左右垂直讀成垂直；仲停喺自動靠位就返去預設", () => {
    const raw = exampleProject();
    const snapped = parseProject({ ...raw, style: { ...raw.style, flow: "right", x: 0.9, y: 0.5 } });
    expect(snapped.style.flow).toBe("vertical");
    expect(snapped.style.x).toBeCloseTo(defaultLook.x);
    expect(snapped.style.y).toBeCloseTo(defaultLook.y);
    const { transX: _keptX, transY: _keptY, ...withoutTrans } = raw.style;
    const moved = parseProject({ ...raw, style: { ...withoutTrans, flow: "left", x: 0.4, y: 0.3 } });
    expect(moved.style.flow).toBe("vertical");
    expect(moved.style.x).toBeCloseTo(0.4);
    expect(moved.style.y).toBeCloseTo(0.3);
    expect(moved.style.transX).toBeCloseTo(0.4 + (defaultLook.size * 1.25) / 1920);
    expect(moved.style.transY).toBeCloseTo(0.3);
    const kept = parseProject({ ...raw, style: { ...raw.style, flow: "vertical", transX: 0.9, transY: 0.2 } });
    expect(kept.style.transX).toBeCloseTo(0.9);
    expect(kept.style.transY).toBeCloseTo(0.2);
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

  it("未寫譯文字體就跟原文，寫咗就各自", () => {
    expect(defaultLook.transFont).toBe("chiron");
    const { transFont: _drop, ...rest } = defaultLook;
    const followed = clampLook({ ...rest, font: "jhenghei" });
    expect(followed.font).toBe("jhenghei");
    expect(followed.transFont).toBe("jhenghei");
    expect(clampLook({ font: "jhenghei", transFont: "  " }).transFont).toBe("jhenghei");
    const kept = clampLook({ ...followed, font: "yahei" });
    expect(kept.font).toBe("yahei");
    expect(kept.transFont).toBe("jhenghei");
    expect(clampLook({ font: "jhenghei", transFont: "kai" })).toMatchObject({ font: "jhenghei", transFont: "kai" });
    expect(canvasFont(kept, 48)).toContain("Microsoft YaHei");
    expect(canvasFont(kept, 32, kept.transFont)).toContain("Microsoft JhengHei");
    expect(buildKaraokeAss(testClipLines(), undefined, clampLook(rest))).toBe(buildKaraokeAss(testClipLines()));
    const raw = exampleProject();
    const { transFont: _gone, ...style } = raw.style;
    const loaded = parseProject({ ...raw, style: { ...style, font: "jhenghei" } });
    expect(loaded.style.font).toBe("jhenghei");
    expect(loaded.style.transFont).toBe("jhenghei");
    const picked = parseProject({ ...raw, style: { ...style, font: "jhenghei", transFont: "kai" } });
    expect(picked.style.font).toBe("jhenghei");
    expect(picked.style.transFont).toBe("kai");
    const changed = parseProject({ ...raw, style: { ...picked.style, font: "yahei" } });
    expect(changed.style.font).toBe("yahei");
    expect(changed.style.transFont).toBe("kai");
  });

  it("放得落就唔收，過長先向下取整", () => {
    expect(lineInk(0, 64, 0, 6)).toBe(0);
    expect(lineInk(3, 64, 0, 6)).toBe(3 * 64 + 12);
    expect(lineInk(3, 64, 8, 6)).toBe(3 * 64 + 16 + 12);
    expect(frameRoom(0.5, playWidth)).toBe(1840);
    expect(frameRoom(0.82, playHeight)).toBeCloseTo(308.8);
    expect(fitPercent(3, 64, 0, 6, 0.5, playWidth)).toBe(100);
    expect(fitUsed(100)).toBe(1);
    expect(fitWidthTag(100)).toBe("");
    const ink = lineInk(40, 64, 0, 6);
    const room = frameRoom(0.5, playWidth);
    expect(ink).toBeGreaterThan(room);
    const percent = fitPercent(40, 64, 0, 6, 0.5, playWidth);
    expect(percent).toBe(Math.floor((room / ink) * 100));
    expect(percent).toBeLessThan(100);
    expect(fitUsed(percent)).toBe(percent / 100);
    expect(fitWidthTag(percent)).toBe(`\\fscx${percent}`);
    expect(fitPercent(10, 64, 0, 0, 0.1, playWidth)).toBeLessThan(fitPercent(10, 64, 0, 0, 0.5, playWidth));
  });
});
