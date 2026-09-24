import { describe, expect, it } from "vitest";
import { buildKaraokeAss, karaokeCentiseconds } from "../../src/core/ass";
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

  it("正的延遲讓字幕晚出現", () => {
    const ass = buildKaraokeAss(testClipLines(), { ...defaultTiming(), offsetMs: 50 });
    expect(ass).toContain("0:00:01.05");
  });
});
