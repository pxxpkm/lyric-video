import { describe, expect, it } from "vitest";
import { buildKaraokeAss, karaokeCentiseconds } from "../../src/core/ass";
import { lyricLine } from "../../src/core/lyrics";
import { assColor, assFontSize, defaultLook } from "../../src/core/lyricLook";
import { setLineFade, setLinePreset, type MotionClip } from "../../src/core/motion";
import { testClipLines } from "../../src/core/preview";
import { exampleProject, parseProject } from "../../src/core/project";
import { defaultTiming } from "../../src/core/timing";

describe("karaoke.ass", () => {
  it("有逐字的句子，\\k 總長等於句長", () => {
    const line = testClipLines()[2];
    const parts = karaokeCentiseconds(line, 1);
    const sung = line.words?.reduce((sum, word) => sum + word.durMs, 0) ?? 0;
    expect(Math.abs(parts.reduce((sum, cs) => sum + cs, 0) - Math.round(sung / 10))).toBeLessThanOrEqual(1);
    const ass = buildKaraokeAss(testClipLines());
    const dialogue = ass.split("\n").find((row) => row.includes("{\\k"));
    expect(dialogue).toBeTruthy();
    const burned = [...(dialogue ?? "").matchAll(/\\k(\d+)/g)].map((match) => Number(match[1]));
    expect(Math.abs(burned.reduce((sum, cs) => sum + cs, 0) - 120)).toBeLessThanOrEqual(1);
  });

  it("沒有逐字就不寫 \\k，譯文在第二行", () => {
    const ass = buildKaraokeAss(testClipLines());
    const first = ass.split("\n").find((row) => row.includes("第一句"));
    expect(first).toBeTruthy();
    expect(first).not.toContain("\\k");
    expect(ass).toContain("第二句譯文");
  });

  it("垂直逐字由上寫到下，中文用自己的位置", () => {
    const look = { ...defaultLook, flow: "vertical" as const, size: 40, transX: 0.8, transY: 0.82 };
    const ass = buildKaraokeAss(testClipLines(), undefined, look);
    expect(ass).not.toContain("\\frz");
    expect(ass).toContain("\\pos(960,846)");
    expect(ass).toContain("\\pos(960,886)");
    expect(ass).toContain("\\pos(960,926)");
    expect(ass).toContain("\\pos(1536,886)");
    expect(ass).toContain("\\t(400,400,\\1c");
    const upright = ass.split("\n").filter((row) => row.includes("第一") || row.includes("句"));
    expect(upright.some((row) => row.endsWith("第一句}"))).toBe(false);
    const legacy = buildKaraokeAss(testClipLines(), undefined, { ...look, flow: "left" as "vertical" });
    expect(legacy).toContain("\\pos(960,846)");
    expect(legacy).not.toContain("\\pos(192,");
  });

  it("譯文有自己的字級同顏色", () => {
    const look = {
      ...defaultLook,
      size: 40,
      color: "#111111",
      sungColor: "#222222",
      transSize: 80,
      transColor: "#ABCDEF",
    };
    const ass = buildKaraokeAss(testClipLines(), undefined, look);
    const orig = ass.split("\n").find((row) => row.startsWith("Style: Orig"));
    const trans = ass.split("\n").find((row) => row.startsWith("Style: Trans"));
    expect(orig).toContain(String(assFontSize(40, "chiron")));
    expect(orig).toContain(assColor("#111111"));
    expect(trans).toContain(String(assFontSize(80, "chiron")));
    expect(trans).toContain(assColor("#ABCDEF"));
    expect(trans).not.toContain(assColor("#111111"));
    const vertical = buildKaraokeAss(testClipLines(), undefined, { ...look, flow: "vertical" });
    const glyph = vertical.split("\n").find((row) => row.endsWith("譯"));
    expect(glyph).toContain(`\\fs${assFontSize(80, "chiron")}`);
    expect(glyph).toContain(`\\1c${assColor("#ABCDEF")}`);
    const main = vertical.split("\n").find((row) => row.endsWith("第"));
    expect(main).toContain(`\\fs${assFontSize(40, "chiron")}`);
    expect(main).toContain(`\\1c${assColor("#111111")}`);
  });

  it("橫排的譯文用自己的位置", () => {
    const look = { ...defaultLook, x: 0.25, y: 0.8, transX: 0.75, transY: 0.3, size: 40 };
    const ass = buildKaraokeAss(testClipLines(), undefined, look);
    expect(ass).toContain("\\pos(480,864)");
    expect(ass).toContain("\\pos(1440,324)");
  });

  it("飛入寫 \\move，終點係定位，直排字距不變", () => {
    const clip = presetClip("1000|第一句", "第一句", 1000, 3000, "fly");
    const row = buildKaraokeAss(testClipLines(), undefined, defaultLook, [clip])
      .split("\n")
      .find((line) => line.includes("第一句"));
    expect(row).toContain("\\move");
    expect(row).not.toContain("\\pos");
    const move = row?.match(/\\move\((\d+),(\d+),(\d+),(\d+),0,350\)/);
    expect(move).toBeTruthy();
    expect(Number(move?.[2])).toBe(Number(move?.[4]) + 72);
    const look = { ...defaultLook, flow: "vertical" as const, size: 40 };
    const moves = buildKaraokeAss(testClipLines(), undefined, look, [clip])
      .split("\n")
      .filter((line) => line.includes("\\move"))
      .map((line) => line.match(/\\move\((\d+),(\d+),(\d+),(\d+),0,(\d+)\)/));
    expect(moves).toHaveLength(3);
    expect(moves.map((match) => Number(match?.[4]))).toEqual([846, 886, 926]);
    expect(moves.map((match) => Number(match?.[2]))).toEqual([918, 958, 998]);
    expect(moves.every((match) => match?.[1] === "960" && match?.[3] === "960" && match?.[5] === "350")).toBe(true);
    expect(Number(moves[1]?.[4]) - Number(moves[0]?.[4])).toBe(40);
    expect(Number(moves[1]?.[2]) - Number(moves[0]?.[2])).toBe(40);
  });

  it("放大同擺正寫縮放同角度，只有淡入唔寫 \\move", () => {
    const scale = presetClip("3000|第二句", "第二句", 3000, 6000, "scale");
    const scaled = buildKaraokeAss(testClipLines(), undefined, defaultLook, [scale]);
    const orig = scaled.split("\n").find((line) => line.includes("第二句") && !line.includes("譯文"));
    const trans = scaled.split("\n").find((line) => line.includes("第二句譯文"));
    expect(orig).toContain("\\fscx82\\fscy82\\t(0,300,\\fscx100\\fscy100)");
    expect(trans).toContain("\\fscx82\\fscy82\\t(0,300,\\fscx100\\fscy100)");
    expect(scaled).not.toContain("\\move");
    const turned = buildKaraokeAss(testClipLines(), undefined, { ...defaultLook, flow: "vertical", size: 40 }, [
      presetClip("1000|第一句", "第一句", 1000, 3000, "turn"),
    ]);
    const glyphs = turned.split("\n").filter((line) => line.includes("\\frz-6\\t(0,300,\\frz0)"));
    expect(glyphs).toHaveLength(3);
    expect(glyphs.every((line) => line.includes("\\pos(") && !line.includes("\\move"))).toBe(true);
    expect(glyphs.map((line) => line.match(/\\pos\(\d+,(\d+)\)/)?.[1])).toEqual(["846", "886", "926"]);
    const faded = setLineFade([], "1000|第一句", "第一句", 1000, 3000, "in", 1);
    const fadeOnly = buildKaraokeAss(testClipLines(), undefined, defaultLook, faded);
    expect(fadeOnly).toContain("\\fade");
    expect(fadeOnly).not.toContain("\\move");
  });

  it("有逐字嘅原文揀變色仍然保留 \\k，譯文成句變色", () => {
    const line = lyricLine(1_000, "甲乙", {
      translatedText: "丙",
      words: [
        { startMs: 0, durMs: 500, text: "甲" },
        { startMs: 500, durMs: 500, text: "乙" },
      ],
    });
    const look = { ...defaultLook, color: "#111111", sungColor: "#222222", transColor: "#ABCDEF" };
    const clip = presetClip("1000|甲乙", "甲乙", 1000, 15_500, "tint");
    const ass = buildKaraokeAss([line], undefined, look, [clip]);
    const orig = ass.split("\n").find((row) => row.includes("\\k"));
    expect(orig).toBeTruthy();
    expect(orig).not.toContain("\\t(0,");
    const trans = ass.split("\n").find((row) => row.includes("丙"));
    expect(trans).toContain(`\\1c${assColor("#ABCDEF")}`);
    expect(trans).toContain("\\t(0,5800,\\1c");
    expect(trans).toContain(assColor("#222222"));
    expect(trans).not.toContain(assColor("#111111"));
    const vertical = buildKaraokeAss([line], undefined, { ...look, flow: "vertical" }, [clip]);
    const sung = vertical.split("\n").filter((row) => row.endsWith("甲") || row.endsWith("乙"));
    expect(sung.every((row) => row.includes("\\t(") && !row.includes("\\t(0,"))).toBe(true);
    const translated = vertical.split("\n").find((row) => row.endsWith("丙"));
    expect(translated).toContain("\\t(0,5800,\\1c");
    expect(translated).toContain(assColor("#ABCDEF"));
  });

  it("舊檔冇預設，重開唔會寫 \\move", () => {
    const raw = exampleProject();
    const parsed = parseProject({
      ...raw,
      lyrics: raw.lyrics,
      motion: [
        {
          id: "a",
          text: "第一句",
          startMs: 1000,
          endMs: 3000,
          lineKey: "1000|第一句",
          enter: { x: 0.2, y: 0.7, opacity: 0 },
          leave: { x: 0.2, y: 0.7, opacity: 1 },
        },
      ],
    });
    expect(parsed.motion[0].preset).toBeUndefined();
    const ass = buildKaraokeAss(testClipLines(), undefined, defaultLook, parsed.motion);
    expect(ass).toContain("\\fade");
    expect(ass).toContain("\\pos(");
    expect(ass).not.toContain("\\move");
  });

  it("正的延遲讓字幕晚出現", () => {
    const ass = buildKaraokeAss(testClipLines(), { ...defaultTiming(), offsetMs: 50 });
    expect(ass).toContain("0:00:01.05");
  });
});

function presetClip(key: string, text: string, startMs: number, endMs: number, preset: NonNullable<MotionClip["preset"]>): MotionClip {
  const clip = setLinePreset([], key, text, startMs, endMs, preset)[0];
  if (!clip) throw new Error("missing clip");
  return clip;
}
