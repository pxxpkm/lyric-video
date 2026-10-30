import { expect, it } from "vitest";
import { buildKaraokeAss } from "../../src/core/ass";
import { applyEdits, lineKey, lyricLine } from "../../src/core/lyrics";
import { setLineFade, setLinePreset } from "../../src/core/motion";
import { lyricClockMs, previewFrame } from "../../src/core/preview";
import { defaultTiming, withLineShift } from "../../src/core/timing";
import { drawPreview, hitsCurrentLyric, readoutFrame } from "../../src/renderer/src/drawPreview";
import { defaultLook } from "../../src/core/lyricLook";

const line = lyricLine(0, "零秒歌詞", {
  translatedText: "譯文",
  words: [{ startMs: 0, durMs: 500, text: "零秒" }, { startMs: 500, durMs: 500, text: "歌詞" }],
});

it("以獨立開始時間公式核對 1917 組偏移、句首、逐句微調及全部速度步進", () => {
  let checked = 0;
  for (let step = 0; step <= 70; step++) {
    const rate = (850 + step * 5) / 1000;
    for (const offsetMs of [50, 2000, 300_000]) {
      for (const atMs of [0, 1500, 360_000]) {
        for (const shift of [-1000, 0, 50]) {
          const sample = lyricLine(atMs, "測試句");
          const timing = withLineShift({ ...defaultTiming(), offsetMs, rate }, lineKey(sample), shift);
          const start = (atMs + shift) / rate + offsetMs;
          expect(readoutFrame([sample], start - 1, timing).index).toBe(-1);
          expect(readoutFrame([sample], start + 1, timing).index).toBe(0);
          const ass = buildKaraokeAss([sample], timing);
          const stamp = ass.split("\n").find(row => row.startsWith("Dialogue:"))!.split(",")[1];
          const [h, m, s] = stamp.split(":").map(Number);
          const exportedStart = (h * 3600 + m * 60 + s) * 1000;
          expect(Math.abs(exportedStart - Math.max(0, start))).toBeLessThanOrEqual(5.001);
          checked++;
        }
      }
    }
  }
  expect(checked).toBe(1917);
});

it.each([.85, 1, 1.2])("正延遲配速度 %s，在開始前沒有原文、譯文或逐字狀態", (rate) => {
  const timing = { ...defaultTiming(), offsetMs: 2000, rate };
  expect(lyricClockMs(1000, 2000, rate)).toBe(-1000 * rate);
  for (const at of [0, 1000, 1999]) {
    expect(readoutFrame([line], at, timing)).toMatchObject({ index: -1, text: "", trans: "", wordIndex: -1 });
  }
  expect(readoutFrame([line], 2000, timing)).toMatchObject({ text: "零秒歌詞", trans: "譯文", wordIndex: 0 });
  expect(readoutFrame([line], 2000 + 501 / rate, timing).wordIndex).toBe(1);
});

it.each([0, 50])("淡入 %ims 不改零秒歌詞真正開始時刻，與 ASS 一致", (fadeInMs) => {
  const timing = { ...defaultTiming(), offsetMs: 2000 };
  const preset = setLinePreset([], lineKey(line), line.text, 2000, 4000, "fly");
  const clips = setLineFade(preset, lineKey(line), line.text, 2000, 4000, "in", fadeInMs);
  expect(clips[0].fadeInMs).toBe(fadeInMs);
  const ass = buildKaraokeAss([line], timing, undefined, clips);
  const events = ass.split("\n").filter(row => row.startsWith("Dialogue:"));
  expect(events.length).toBe(2);
  expect(events.every(row => row.split(",")[1] === "0:00:02.00")).toBe(true);
  expect(previewFrame([line], lyricClockMs(1999, 2000, 1), timing).index).toBe(-1);
  expect(previewFrame([line], lyricClockMs(2000, 2000, 1), timing).index).toBe(0);
});

it("逐句提早至負歌詞時間時，仍按有效開始時間顯示", () => {
  const timing = withLineShift({ ...defaultTiming(), offsetMs: 2000 }, lineKey(line), -1000);
  const shown = applyEdits([line], timing);
  expect(readoutFrame([line], 999, timing).index).toBe(-1);
  expect(readoutFrame([line], 1000, timing).index).toBe(0);
  expect(previewFrame(shown, -500, timing).index).toBe(0);
  expect(buildKaraokeAss([line], timing)).toContain("Dialogue: 0,0:00:01.00,");
});

it("零延遲、負延遲及無效速度維持既有方向", () => {
  expect(readoutFrame([line], 0).wordIndex).toBe(0);
  expect(readoutFrame([line], 0, { ...defaultTiming(), offsetMs: -600 }).wordIndex).toBe(1);
  for (const rate of [0, -1, NaN, Infinity]) {
    expect(lyricClockMs(1000, 2000, rate)).toBe(-1000);
  }
});

it.each(["horizontal", "vertical"] as const)("%s 關閉淡入後，開始前不畫歌詞亦不能拖中", (flow) => {
  Object.assign(globalThis, { window: { devicePixelRatio: 1 } });
  const paints: string[] = [];
  const ctx = {
    font: "", globalAlpha: 1,
    save() {}, restore() {}, setTransform() {}, clearRect() {}, fillRect() {},
    translate() {}, rotate() {}, scale() {}, strokeText() {},
    measureText(text: string) { return { width: text.length * 64 }; },
    fillText(text: string) { paints.push(text); },
  };
  const canvas = { width: 1920, height: 1080, clientWidth: 1920, clientHeight: 1080, getContext: () => ctx } as unknown as HTMLCanvasElement;
  const timing = { ...defaultTiming(), offsetMs: 2000 };
  const look = { ...defaultLook, flow };
  const clips = setLineFade(setLinePreset([], lineKey(line), line.text, 2000, 4000, "fly"), lineKey(line), line.text, 2000, 4000, "in", 0);
  expect(clips[0].fadeInMs).toBe(0);
  const before = drawPreview(canvas, [line], 1999, "video", timing, look, clips);
  expect(before.index).toBe(-1);
  expect(paints.some(text => /零|秒|歌|詞|譯/.test(text) && text !== "尚未有歌詞")).toBe(false);
  expect(hitsCurrentLyric(canvas, [line], 1999, timing, look, clips, { x: 960, y: 886 })).toBeNull();
  paints.length = 0;
  const started = drawPreview(canvas, [line], 2000, "video", timing, look, clips);
  expect(started.wordIndex).toBe(0);
  expect(paints.some(text => text.includes("零"))).toBe(true);
});
