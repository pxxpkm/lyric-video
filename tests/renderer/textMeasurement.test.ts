import { afterEach, expect, it, vi } from "vitest";
import { defaultLook } from "../../src/core/lyricLook";
import { lyricLine } from "../../src/core/lyrics";

afterEach(() => vi.unstubAllGlobals());

async function setup() {
  vi.resetModules();
  let factor = 1;
  const listeners: Record<string, () => void> = {};
  const ctx = {
    font: "",
    measureText: vi.fn((text: string) => ({ width: text.length * (ctx.font.includes("KaiTi") ? 20 : 10) * factor })),
  };
  vi.stubGlobal("document", {
    createElement: () => ({ getContext: () => ctx }),
    fonts: { addEventListener: (event: string, callback: () => void) => { listeners[event] = callback; } },
  });
  const module = await import("../../src/renderer/src/textMeasurement");
  return { ...module, ctx, listeners, changeFont: () => { factor = 2; } };
}

it("字體載入後清除舊量度，字體分開快取", async () => {
  const m = await setup();
  expect(m.measureTextEm("English", "chiron", defaultLook)).toBe(70 / 64);
  expect(m.measureTextEm("English", "kai", defaultLook)).toBe(140 / 64);
  m.changeFont();
  expect(m.measureTextEm("English", "chiron", defaultLook)).toBe(70 / 64);
  m.listeners.loadingdone();
  expect(m.measureTextEm("English", "chiron", defaultLook)).toBe(140 / 64);
});

it("匯出收集原文、譯文及去空白版本，純中日文不量度", async () => {
  const m = await setup();
  const rows = m.collectTextMeasurements([
    lyricLine(0, "English", { translatedText: " English " }),
    lyricLine(1000, "中文日本語"),
  ], { ...defaultLook, transFont: "kai" });
  expect(rows).toEqual(expect.arrayContaining([
    { text: "English", font: "chiron", em: 70 / 64 },
    { text: " English ", font: "kai", em: 180 / 64 },
    { text: "English", font: "kai", em: 140 / 64 },
  ]));
  expect(rows).toHaveLength(3);
});
