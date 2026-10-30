import { expect, it } from "vitest";
import { defaultLook } from "../../src/core/lyricLook";
import { placeLineClip, placeTransClip } from "../../src/core/motion";
import { alignLyricPositions, moveLyricPositions, restoreLyricPositions } from "../../src/core/positionEditing";

const look = { ...defaultLook, x: .3, y: .2, transX: .7, transY: .2 };
const line = { key: "1000|甲", text: "甲", startMs: 1000, endMs: 3000 };

it("成首拖動不建立逐句偏移，原文譯文可獨立移動", () => {
  const orig = moveLyricPositions(look, [], "song", "orig", line, .1, .1);
  expect(orig.look.x).toBeCloseTo(.4);
  expect(orig.look.transX).toBe(.7);
  expect(orig.clips).toEqual([]);
  const trans = moveLyricPositions(look, [], "song", "trans", line, -.1, .1);
  expect(trans.look.x).toBe(.3);
  expect(trans.look.transX).toBeCloseTo(.6);
});

it("例外句以拖動差值移動，不跳到滑鼠；不影響其他句及譯文", () => {
  let clips = placeLineClip([], line.key, line.text, 1000, 3000, .4, .3, look);
  clips = placeLineClip(clips, "other", "另一句", 4000, 6000, .6, .4, look);
  const before = structuredClone(clips);
  const result = moveLyricPositions(look, clips, "line", "orig", line, .05, .1);
  expect(result.look).toBe(look);
  expect(result.clips[0].enter.x).toBeCloseTo(.15);
  expect(result.clips[0].trans).toEqual(before[0].trans);
  expect(result.clips[1]).toEqual(before[1]);
  expect(clips).toEqual(before);
  const noMove = moveLyricPositions(look, clips, "line", "orig", line, 0, 0);
  expect(noMove.clips[0].enter.x).toBeCloseTo(clips[0].enter.x);
});

it("沒有當前句時逐句模式不會退回移動成首", () => {
  const result = moveLyricPositions(look, [], "line", "both", null, .1, .2);
  expect(result.look).toBe(look);
  expect(result.clips).toEqual([]);
});

it("統一原文位置清除舊偏移，保留譯文、淡入及預設；撤回只還原位置", () => {
  let clips = placeLineClip([], line.key, line.text, 1000, 3000, .4, .3, look);
  clips = placeTransClip(clips, line.key, line.text, 1000, 3000, .8, .4, look);
  clips = placeLineClip(clips, "other", "另一句", 4000, 6000, .6, .4, look);
  clips[0] = { ...clips[0], preset: "fly", fadeInMs: 300 };
  const aligned = alignLyricPositions(look, clips, "orig", line.key);
  expect(aligned.look.x).toBeCloseTo(.4);
  expect(aligned.clips.every((clip) => clip.enter.x === 0 && clip.enter.y === 0)).toBe(true);
  expect(aligned.clips[0].trans).toEqual(clips[0].trans);
  expect(aligned.clips[0].preset).toBe("fly");
  expect(aligned.clips[0].fadeInMs).toBe(300);
  const restored = restoreLyricPositions({ ...aligned.look, size: 77, showOriginal: false }, aligned.clips, { look, clips }, "orig");
  expect(restored.look.x).toBe(look.x);
  expect(restored.look.size).toBe(77);
  expect(restored.look.showOriginal).toBe(false);
  expect(restored.clips[0].enter).toEqual(clips[0].enter);
});
