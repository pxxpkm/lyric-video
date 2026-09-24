export type PreviewWord = { startMs: number; durMs: number; text: string };

export type PreviewLine = {
  atMs: number;
  text: string;
  trans: string;
  words: PreviewWord[];
};

export type PreviewSession = {
  title: string;
  artist: string;
  mediaPath: string;
  mode: "video" | "audio";
  durationMs: number;
  lines: PreviewLine[];
};

export function mediaSrc(filePath: string): string {
  return `media://local/?path=${encodeURIComponent(filePath)}`;
}
