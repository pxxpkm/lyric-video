import { clampLook, moveLook, type LyricLook } from "./lyricLook";
import { placeLineClip, placeTransClip, transOffset, type MotionClip } from "./motion";

export type PositionTarget = "orig" | "trans" | "both";
export type PositionLine = { key: string; text: string; startMs: number; endMs: number };

export function moveLyricPositions(look: LyricLook, clips: MotionClip[], scope: "song" | "line", target: PositionTarget, line: PositionLine | null, dx: number, dy: number) {
  if (scope === "song") {
    const nextLook = target === "both" ? moveLook(look, dx, dy) : target === "orig"
      ? clampLook({ ...look, x: look.x + dx, y: look.y + dy })
      : clampLook({ ...look, transX: look.transX + dx, transY: look.transY + dy });
    return { look: nextLook, clips };
  }
  if (!line) return { look, clips };
  const clip = clips.find((item) => item.lineKey === line.key);
  const trans = clip ? transOffset(clip) : { x: 0, y: 0 };
  let next = clips;
  if (target !== "trans") next = placeLineClip(next, line.key, line.text, line.startMs, line.endMs, look.x + (clip?.enter.x ?? 0) + dx, look.y + (clip?.enter.y ?? 0) + dy, look);
  if (target !== "orig") next = placeTransClip(next, line.key, line.text, line.startMs, line.endMs, look.transX + trans.x + dx, look.transY + trans.y + dy, look);
  return { look, clips: next };
}

export function alignLyricPositions(look: LyricLook, clips: MotionClip[], target: PositionTarget, referenceKey?: string) {
  const reference = clips.find((clip) => clip.lineKey === referenceKey);
  const shift = reference ? transOffset(reference) : { x: 0, y: 0 };
  const nextLook = clampLook({ ...look,
    ...(target !== "trans" ? { x: look.x + (reference?.enter.x ?? 0), y: look.y + (reference?.enter.y ?? 0) } : {}),
    ...(target !== "orig" ? { transX: look.transX + shift.x, transY: look.transY + shift.y } : {}),
  });
  const nextClips = clips.map((clip) => {
    if (!clip.lineKey) return clip;
    const translated = transOffset(clip);
    return { ...clip,
      ...(target !== "trans" ? { enter: { ...clip.enter, x: 0, y: 0 }, leave: { ...clip.leave, x: 0, y: 0 } } : {}),
      trans: target !== "orig" ? { x: 0, y: 0 } : translated,
    };
  });
  return { look: nextLook, clips: nextClips };
}

export function restoreLyricPositions(look: LyricLook, clips: MotionClip[], previous: { look: LyricLook; clips: MotionClip[] }, target: PositionTarget) {
  const restoredLook = { ...look,
    ...(target !== "trans" ? { x: previous.look.x, y: previous.look.y } : {}),
    ...(target !== "orig" ? { transX: previous.look.transX, transY: previous.look.transY } : {}),
  };
  const restoredClips = clips.map((clip) => {
    const old = previous.clips.find((item) => item.id === clip.id);
    const trans = old ? transOffset(old) : { x: 0, y: 0 };
    return { ...clip,
      ...(target !== "trans" ? { enter: { ...clip.enter, x: old?.enter.x ?? 0, y: old?.enter.y ?? 0 }, leave: { ...clip.leave, x: old?.leave.x ?? 0, y: old?.leave.y ?? 0 } } : {}),
      ...(target !== "orig" ? { trans } : {}),
    };
  });
  return { look: restoredLook, clips: restoredClips };
}
