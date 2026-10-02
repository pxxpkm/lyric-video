import { describe, expect, it } from "vitest";
import { buildKaraokeAss, karaokeCentiseconds } from "../../src/core/ass";
import { assColor, assFontSize, defaultLook } from "../../src/core/lyricLook";
import { testClipLines } from "../../src/core/preview";
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

  it("正的延遲讓字幕晚出現", () => {
    const ass = buildKaraokeAss(testClipLines(), { ...defaultTiming(), offsetMs: 50 });
    expect(ass).toContain("0:00:01.05");
  });
});
