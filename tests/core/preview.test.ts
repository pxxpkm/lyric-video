import { describe, expect, it } from "vitest";
import { previewFrame, testClipLines } from "../../src/core/preview";
import { testToneWav, wavSample } from "../../src/core/testTone";

describe("預覽時間軸", () => {
  const lines = testClipLines();

  it("開頭還沒有句子", () => {
    expect(previewFrame(lines, 500)).toMatchObject({ index: -1, key: "", wordIndex: -1, text: "" });
  });

  it("第一聲之後是第一句", () => {
    expect(previewFrame(lines, 1_500)).toMatchObject({
      key: "1000|第一句",
      text: "第一句",
      wordIndex: -1,
      trans: "",
    });
  });

  it("中段是第二句，帶譯文", () => {
    expect(previewFrame(lines, 4_500)).toMatchObject({
      text: "第二句",
      trans: "第二句譯文",
    });
  });

  it("6.5 秒亮到第二個字", () => {
    expect(previewFrame(lines, 6_500)).toMatchObject({
      key: "6000|第三句",
      text: "第三句",
      wordIndex: 1,
    });
  });
});

function peak(wav: Uint8Array, fromSec: number, toSec: number): number {
  let best = 0;
  for (let time = fromSec; time < toSec; time += 0.001) {
    best = Math.max(best, Math.abs(wavSample(wav, 44_100, time)));
  }
  return best;
}

describe("測試片音訊", () => {
  it("十秒 wav，嗶聲在句子開始，其餘是靜音", () => {
    const wav = testToneWav();
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    expect(wav.byteLength).toBe(44 + 44_100 * 10 * 2);
    expect(wavSample(wav, 44_100, 0.5)).toBe(0);
    expect(peak(wav, 1, 1.15)).toBeGreaterThan(1000);
    expect(peak(wav, 3, 3.15)).toBeGreaterThan(1000);
    expect(peak(wav, 6, 6.15)).toBeGreaterThan(1000);
  });
});
