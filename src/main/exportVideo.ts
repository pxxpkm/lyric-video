import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { buildKaraokeAss } from "../core/ass";
import { lyricLine, type LyricLine } from "../core/lyrics";
import { timingFromProject } from "../core/projectTiming";
import type { PreviewLine, StoredTiming } from "../shared/preview";
import { runCommand } from "./media";

export type ExportRequest = {
  projectPath: string;
  mediaPath: string;
  mode: "video" | "audio";
  durationMs: number;
  lines: PreviewLine[];
  timing: StoredTiming;
};

export async function exportProject(
  request: ExportRequest,
  fontsDir: string,
  onProgress: (text: string) => void,
): Promise<{ ok: true; outPath: string; assPath: string } | { ok: false; error: string }> {
  const folder = dirname(request.projectPath);
  await mkdir(folder, { recursive: true });
  const assPath = join(folder, "karaoke.ass");
  const lines = request.lines.map((line) =>
    lyricLine(line.atMs, line.text, {
      translatedText: line.trans || null,
      words: line.words.length > 0 ? line.words : null,
    }),
  ) satisfies LyricLine[];
  await writeFile(assPath, buildKaraokeAss(lines, timingFromProject(request.timing)), "utf8");
  onProgress("正在燒進影片");

  const part = join(folder, "out.part.mp4");
  const outPath = join(folder, "out.mp4");
  const fonts = relative(folder, fontsDir).replaceAll("\\", "/");
  const filter = `ass=karaoke.ass:fontsdir=${fonts}`;
  const args =
    request.mode === "audio"
      ? [
          "-y",
          "-f",
          "lavfi",
          "-i",
          "color=c=0x243044:s=1920x1080:r=30",
          "-i",
          request.mediaPath,
          "-shortest",
          "-vf",
          filter,
          "-map",
          "0:v",
          "-map",
          "1:a",
        ]
      : [
          "-y",
          "-i",
          request.mediaPath,
          "-vf",
          `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,${filter}`,
        ];
  args.push(
    "-c:v",
    "libx264",
    "-crf",
    "18",
    "-preset",
    "medium",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    "-progress",
    "pipe:1",
    "-nostats",
    part,
  );

  let lastText = "";
  let buffer = "";
  const result = await runCommand("ffmpeg", args, (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\n/);
    buffer = lines.pop() ?? "";
    const text = readExportProgress(lines.join("\n"), request.durationMs);
    if (!text || text === lastText) return;
    lastText = text;
    onProgress(text);
  }, folder);
  if (result.code !== 0) {
    await rm(part, { force: true });
    const tail = result.stderr.trim().split(/\r?\n/).slice(-3).join(" ");
    return { ok: false, error: tail || "匯出失敗" };
  }
  await rm(outPath, { force: true });
  await rename(part, outPath);
  onProgress("匯出完成");
  return { ok: true, outPath, assPath };
}

export function readExportProgress(chunk: string, durationMs: number): string | null {
  let last: string | null = null;
  for (const line of chunk.split(/\r?\n/)) {
    const match = /^out_time=(\d+):(\d+):(\d+)\.(\d+)/.exec(line.trim());
    if (!match || durationMs <= 0) continue;
    const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
    const fraction = Number(`0.${match[4]}`);
    const percent = Math.min(99, Math.round(((seconds + fraction) * 1000 / durationMs) * 100));
    last = `正在匯出 ${percent}%`;
  }
  return last;
}
