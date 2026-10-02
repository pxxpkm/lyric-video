import type { LyricLook } from "../core/lyricLook";
import type { MotionClip } from "../core/motion";

export type PreviewWord = { startMs: number; durMs: number; text: string };

export type PreviewLine = {
  atMs: number;
  text: string;
  trans: string;
  words: PreviewWord[];
};

export type StoredTiming = {
  offsetMs: number;
  rate: number;
  lines: Record<string, number>;
  holds: Record<string, number>;
  texts: Record<string, string>;
  trans: Record<string, string>;
  added: { atMs: number; text: string; id: string; trans?: string }[];
};

export type PreviewSession = {
  title: string;
  artist: string;
  mediaPath: string;
  projectPath: string;
  mode: "video" | "audio";
  durationMs: number;
  lines: PreviewLine[];
  timing: StoredTiming;
  look: LyricLook;
  motion: MotionClip[];
};

export function mediaSrc(filePath: string): string {
  return `media://local/?path=${encodeURIComponent(filePath)}`;
}
