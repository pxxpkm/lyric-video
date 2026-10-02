import { describe, expect, it } from "vitest";
import { defaultTiming } from "../../src/core/timing";
import { defaultLook } from "../../src/core/lyricLook";
import { testClipLines } from "../../src/core/preview";
import { drawPreview } from "../../src/renderer/src/drawPreview";

describe("預覽字體", () => {
  it("橫排成句的原文用原文字體，譯文用譯文字體", () => {
    const host = globalThis as { window?: { devicePixelRatio: number } };
    host.window ??= { devicePixelRatio: 1 };
    host.window.devicePixelRatio = 1;
    const paints: { text: string; font: string }[] = [];
    const ctx = {
      font: "16px sans-serif",
      fillStyle: "",
      strokeStyle: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      globalAlpha: 1,
      filter: "none",
      lineJoin: "miter",
      miterLimit: 10,
      lineWidth: 1,
      stack: [] as string[],
      save() {
        this.stack.push(this.font);
      },
      restore() {
        const prev = this.stack.pop();
        if (prev != null) this.font = prev;
      },
      setTransform() {},
      clearRect() {},
      fillRect() {},
      translate() {},
      rotate() {},
      scale() {},
      measureText(text: string) {
        return { width: Array.from(text).length * 10 };
      },
      fillText(text: string) {
        paints.push({ text, font: this.font });
      },
      strokeText(text: string) {
        paints.push({ text, font: this.font });
      },
    };
    const canvas = {
      clientWidth: 1920,
      clientHeight: 1080,
      width: 1920,
      height: 1080,
      getContext: () => ctx,
    };
    const look = { ...defaultLook, font: "kai", transFont: "jhenghei", size: 64, transSize: 36 };
    drawPreview(canvas as unknown as HTMLCanvasElement, testClipLines(), 4_000, "audio", defaultTiming(), look, []);
    const orig = paints.filter((paint) => paint.text === "第二句");
    const trans = paints.filter((paint) => paint.text === "第二句譯文");
    expect(orig.length).toBeGreaterThan(0);
    expect(trans.length).toBeGreaterThan(0);
    expect(orig.every((paint) => paint.font.startsWith('64px "KaiTi"'))).toBe(true);
    expect(trans.every((paint) => paint.font.startsWith('36px "Microsoft JhengHei"'))).toBe(true);
  });
});
