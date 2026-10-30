import { expect, it } from "vitest";
import { defaultLook } from "../../src/core/lyricLook";
import { lyricLine } from "../../src/core/lyrics";
import { defaultTiming } from "../../src/core/timing";
import { drawPreview, hitsCurrentLyric } from "../../src/renderer/src/drawPreview";

function canvasFixture() {
  Object.assign(globalThis, { window: { devicePixelRatio: 1 } });
  const marks: { text: string; x: number; y: number }[] = [];
  const ctx = {
    font: "16px sans-serif", globalAlpha: 1,
    save() {}, restore() {}, setTransform() {}, clearRect() {}, fillRect() {},
    translate() {}, rotate() {}, scale() {}, strokeText() {},
    measureText(text: string) { return { width: text.length * 64 }; },
    fillText(text: string, x: number, y: number) { marks.push({ text, x, y }); },
  };
  return { marks, canvas: { width: 1920, height: 1080, clientWidth: 1920, clientHeight: 1080, getContext: () => ctx } as unknown as HTMLCanvasElement };
}

const look = { ...defaultLook, flow: "vertical" as const, verticalAnchor: "first" as const, x: .3, y: .2, transX: .7, transY: .2 };
const lines = [lyricLine(1000, "甲乙", { translatedText: "譯文" }), lyricLine(5000, "天地玄黃宇宙洪荒")];

it("預覽長短句第一字同座標，第一字命中範圍與畫面一致", () => {
  const { marks, canvas } = canvasFixture();
  drawPreview(canvas, lines, 1500, "video", defaultTiming(), look);
  expect(marks.find((mark) => mark.text === "甲")).toMatchObject({ x: 576, y: 216 });
  expect(hitsCurrentLyric(canvas, lines, 1500, defaultTiming(), look, [], { x: 576, y: 216 })).toBe("orig");
  drawPreview(canvas, lines, 5500, "video", defaultTiming(), look);
  expect(marks.find((mark) => mark.text === "天")).toMatchObject({ x: 576, y: 216 });
});

it.each(["horizontal", "vertical"] as const)("%s 預覽隱藏原文仍顯示譯文，不刪時機或讓原文可被命中", (flow) => {
  const { marks, canvas } = canvasFixture();
  const hidden = { ...look, flow, showOriginal: false };
  const before = JSON.stringify(lines);
  const frame = drawPreview(canvas, lines, 1500, "video", defaultTiming(), hidden);
  expect(frame.text).toBe("甲乙");
  expect(marks.some((mark) => mark.text.includes("甲") || mark.text.includes("乙"))).toBe(false);
  expect(marks.some((mark) => mark.text.includes("譯"))).toBe(true);
  expect(hitsCurrentLyric(canvas, lines, 1500, defaultTiming(), hidden, [], { x: 576, y: 216 })).toBeNull();
  expect(hitsCurrentLyric(canvas, lines, 1500, defaultTiming(), hidden, [], { x: 1344, y: 216 })).toBe("trans");
  expect(JSON.stringify(lines)).toBe(before);
});
