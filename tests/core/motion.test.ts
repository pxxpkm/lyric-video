import { describe, expect, it } from "vitest";
import {
  addFreeClip,
  assMotion,
  clearLineMotions,
  lyricBands,
  placeLineClip,
  placeTransClip,
  sampleTrans,
  verticalColumns,
  pointOnBands,
  sampleClip,
  setLineFade,
  setLinesFade,
  type MotionClip,
} from "../../src/core/motion";
import { exampleProject, parseProject } from "../../src/core/project";

const look = { x: 0.5, y: 0.82, transX: 0.5, transY: 0.9 };

const clip: MotionClip = {
  id: "line:a",
  text: "第一句",
  startMs: 0,
  endMs: 1000,
  lineKey: "a",
  enter: { x: -0.3, y: -0.02, opacity: 0 },
  leave: { x: 0.3, y: -0.42, opacity: 1 },
  locked: true,
  basis: "look",
};

describe("片段運動", () => {
  it("位置固定，透明度仍可在頭尾之間過渡", () => {
    const start = sampleClip(clip, 0, look);
    expect(start.x).toBeCloseTo(0.2);
    expect(start.y).toBeCloseTo(0.8);
    expect(start.opacity).toBe(0);
    const mid = sampleClip(clip, 500, look);
    expect(mid.x).toBeCloseTo(0.2);
    expect(mid.y).toBeCloseTo(0.8);
    expect(mid.opacity).toBeCloseTo(0.5);
    const end = sampleClip(clip, 1000, look);
    expect(end.x).toBeCloseTo(0.2);
    expect(end.y).toBeCloseTo(0.8);
    expect(end.opacity).toBe(1);
  });

  it("位置不同也不寫移動，只在透明度有變時淡入", () => {
    expect(assMotion(clip, look)).toContain("\\pos(384,864)");
    expect(assMotion(clip, look)).not.toContain("\\move");
    expect(assMotion(clip, look)).toContain("\\fade(255,0,0,0,1000,1000,1000)");
    const still = {
      ...clip,
      enter: { x: -0.3, y: -0.02, opacity: 1 },
      leave: { x: -0.3, y: -0.02, opacity: 1 },
    };
    expect(assMotion(still, look)).toContain("\\pos(384,864)");
    expect(assMotion(still, look)).not.toContain("\\move");
    expect(assMotion(still, look)).not.toContain("\\fade");
  });

  it("拖動只改這一句，記住同成首的距離", () => {
    const next = placeLineClip([], "1000|第一句", "第一句", 1000, 3000, 0.2, 0.9, look);
    expect(next[0].basis).toBe("look");
    expect(next[0].locked).toBe(true);
    expect(next[0].enter.x).toBeCloseTo(0.2 - look.x);
    expect(next[0].enter.y).toBeCloseTo(0.9 - look.y);
    expect(next[0].leave.x).toBeCloseTo(next[0].enter.x);
    expect(sampleClip(next[0], 2000, look)).toMatchObject({ x: 0.2, y: 0.9 });
    const other = placeLineClip(next, "2000|第二句", "第二句", 3000, 5000, 0.4, 0.7, look);
    expect(other[0].enter.x).toBeCloseTo(next[0].enter.x);
    expect(sampleClip(other[1], 4000, look).x).toBeCloseTo(0.4);
  });

  it("成首移動會帶住已經單獨擺過的句子", () => {
    const next = placeLineClip([], "a", "甲", 0, 1000, 0.2, 0.9, look);
    const moved = { x: look.x + 0.1, y: look.y - 0.05 };
    expect(next[0].enter.x).toBeCloseTo(0.2 - look.x);
    const seen = sampleClip(next[0], 500, moved);
    expect(seen.x).toBeCloseTo(0.3);
    expect(seen.y).toBeCloseTo(0.85);
  });

  it("淡入淡出不帶動位置，之後仍跟成首", () => {
    const placed = placeLineClip([], "1000|第一句", "第一句", 0, 1000, 0.3, 0.4, look);
    const faded = setLineFade(placed, "1000|第一句", "第一句", 0, 1000, "out", 1);
    expect(faded[0].enter.x).toBeCloseTo(placed[0].enter.x);
    expect(sampleClip(faded[0], 1000, look)).toMatchObject({ x: 0.3, y: 0.4, opacity: 0 });
    const fresh = setLineFade([], "1000|第一句", "第一句", 0, 1000, "in", 1);
    expect(fresh[0].enter).toMatchObject({ x: 0, y: 0, opacity: 0 });
    expect(sampleClip(fresh[0], 0, look)).toMatchObject({ x: look.x, y: look.y, opacity: 0 });
    expect(sampleClip(fresh[0], 0, { x: 0.6, y: 0.7 }).x).toBeCloseTo(0.6);
    expect(assMotion(fresh[0], look)).toContain("\\pos(");
    expect(assMotion(fresh[0], look)).not.toContain("\\move");
  });

  it("自由文字不綁歌詞", () => {
    const next = addFreeClip([], "歌名", 2000, 5000, { x: 0.5, y: 0.2 });
    expect(next[0].lineKey).toBe("");
    expect(next[0].text).toBe("歌名");
    expect(next[0].basis).toBe("look");
  });

  it("舊專案沒有片段也開得了", () => {
    const raw = exampleProject();
    const { motion: _motion, ...older } = raw;
    expect(parseProject(older).motion).toEqual([]);
  });

  it("舊的絕對位置打開後變成同成首的偏移，再讀一次不會再減", () => {
    const raw = exampleProject();
    const parsed = parseProject({
      ...raw,
      motion: [
        {
          id: "a",
          text: "甲",
          startMs: 0,
          endMs: 1000,
          lineKey: "a",
          enter: { x: 0.2, y: 0.7, opacity: 1 },
          leave: { x: 0.8, y: 0.2, opacity: 0.25 },
        },
      ],
    });
    const clip = parsed.motion[0];
    expect(clip.basis).toBe("look");
    expect(clip.locked).toBe(true);
    expect(clip.enter.x).toBeCloseTo(0.2 - raw.style.x);
    expect(clip.enter.y).toBeCloseTo(0.7 - raw.style.y);
    expect(clip.leave.x).toBeCloseTo(clip.enter.x);
    expect(clip.leave.y).toBeCloseTo(clip.enter.y);
    expect(clip.leave.opacity).toBe(0.25);
    expect(clip.trans?.x).toBeCloseTo(clip.enter.x);
    expect(clip.trans?.y).toBeCloseTo(clip.enter.y);
    expect(sampleClip(clip, 0, raw.style)).toMatchObject({ x: 0.2, y: 0.7, opacity: 1 });
    const again = parseProject({ ...raw, motion: parsed.motion });
    expect(again.motion[0].enter.x).toBeCloseTo(clip.enter.x);
    expect(again.motion[0].enter.y).toBeCloseTo(clip.enter.y);
  });

  it("全選的淡入淡出套用到每一句，原本的距離留住", () => {
    const first = placeLineClip([], "a", "甲", 0, 1000, 0.2, 0.9, look);
    const both = placeLineClip(first, "b", "乙", 1000, 2000, 0.4, 0.7, look);
    const faded = setLinesFade(
      both,
      [
        { lineKey: "a", text: "甲", startMs: 0, endMs: 1000 },
        { lineKey: "b", text: "乙", startMs: 1000, endMs: 2000 },
        { lineKey: "c", text: "丙", startMs: 2000, endMs: 3000 },
      ],
      "in",
      1,
    );
    expect(faded).toHaveLength(3);
    for (const key of ["a", "b", "c"]) {
      const clip = faded.find((item) => item.lineKey === key);
      expect(clip?.enter.opacity).toBe(0);
    }
    expect(faded[0].enter.x).toBeCloseTo(both[0].enter.x);
    expect(faded[1].enter.y).toBeCloseTo(both[1].enter.y);
    expect(faded[2].enter.x).toBe(0);
    const cleared = clearLineMotions(faded, ["a", "b"]);
    expect(cleared.map((item) => item.lineKey)).toEqual(["c"]);
  });

  it("原文同譯文可以分開擺", () => {
    const orig = placeLineClip([], "a", "甲", 0, 1000, 0.2, 0.8, look);
    expect(orig[0].trans).toEqual({ x: 0, y: 0 });
    expect(sampleTrans(orig[0], look)).toMatchObject({ x: look.transX, y: look.transY });
    const both = placeTransClip(orig, "a", "甲", 0, 1000, 0.85, 0.3, look);
    expect(sampleClip(both[0], 500, look).x).toBeCloseTo(0.2);
    expect(sampleTrans(both[0], look).x).toBeCloseTo(0.85);
    expect(sampleTrans(both[0], look).y).toBeCloseTo(0.3);
    const movedOrig = placeLineClip(both, "a", "甲", 0, 1000, 0.15, 0.7, look);
    expect(sampleTrans(movedOrig[0], look).x).toBeCloseTo(0.85);
    expect(sampleClip(movedOrig[0], 0, look).x).toBeCloseTo(0.15);
    expect(sampleClip(movedOrig[0], 0, look).y).toBeCloseTo(0.7);
  });

  it("直排的原文同譯文用各自的中心", () => {
    const cols = verticalColumns(100, 200, 320, 180, 40, 0.5, { main: 3, trans: 2 });
    expect(cols.main.h).toBe(120);
    expect(cols.main.x).toBe(100);
    expect(cols.main.y).toBe(200);
    expect(cols.trans?.x).toBe(320);
    expect(cols.trans?.y).toBe(180);
    expect(pointOnBands({ x: 100, y: 240 }, [cols.main, cols.trans])).toBe(true);
    expect(pointOnBands({ x: 100, y: 280 }, [cols.main, cols.trans])).toBe(false);
    expect(pointOnBands({ x: 320, y: 180 }, [cols.main, cols.trans])).toBe(true);
  });

  it("撳在字幕或譯文上面才算自由拖", () => {
    const bands = lyricBands(100, 200, 400, 220, 40, 0.6, { main: 80, trans: 40 });
    expect(pointOnBands({ x: 100, y: 200 }, [bands.main, bands.trans])).toBe(true);
    expect(pointOnBands({ x: 400, y: 220 }, [bands.main, bands.trans])).toBe(true);
    expect(pointOnBands({ x: 100, y: 280 }, [bands.main, bands.trans])).toBe(false);
    expect(pointOnBands({ x: 10, y: 10 }, [bands.main, bands.trans])).toBe(false);
    const mainOnly = lyricBands(100, 200, 400, 220, 40, 0.6, { main: 80, trans: 0 });
    expect(pointOnBands({ x: 400, y: 220 }, [mainOnly.main, mainOnly.trans])).toBe(false);
  });
});
