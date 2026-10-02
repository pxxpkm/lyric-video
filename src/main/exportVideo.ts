import { copyFile, mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { buildKaraokeAss } from "../core/ass";
import { exportPartPath } from "../core/exportName";
import type { MotionClip } from "../core/motion";
import { clampLook, type LyricLook } from "../core/lyricLook";
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
  look?: LyricLook;
  title?: string;
  outPath: string;
  motion?: MotionClip[];
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
  await writeFile(
    assPath,
    buildKaraokeAss(lines, timingFromProject(request.timing), clampLook(request.look), request.motion ?? []),
    "utf8",
  );

  const outPath = request.outPath;
  await mkdir(dirname(outPath), { recursive: true });
  const part = exportPartPath(outPath);
  const fonts = assFontsDirPlan(folder, fontsDir);
  if (fonts.copyTo) {
    onProgress("正在準備字體");
    try {
      await ensureExportFonts(fontsDir, fonts.copyTo);
    } catch {
      return { ok: false, error: "字體未能複製到匯出目錄" };
    }
  }
  onProgress("正在燒進影片");
  const filter = `ass=karaoke.ass:fontsdir=${fonts.token}:original_size=1920x1080`;
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

const SAFE_ASS_PATH = /^[A-Za-z0-9._/-]+$/;

export type AssFontsDirPlan = { token: string; copyTo: string | null };

// ass 濾鏡把空格和冒號當成分隔。跳脫磁碟機冒號不夠，路徑裡有空格仍會斷。
export function assFontsDirPlan(clipFolder: string, fontsDir: string): AssFontsDirPlan {
  const direct = safeAssRelative(clipFolder, fontsDir);
  if (direct) return { token: direct, copyTo: null };
  const staged = resolve(clipFolder, "..", "..", "export-fonts");
  const token = safeAssRelative(clipFolder, staged);
  if (token) return { token, copyTo: staged };
  return { token: "export-fonts", copyTo: join(clipFolder, "export-fonts") };
}

function safeAssRelative(from: string, to: string): string | null {
  const rel = relative(from, to);
  if (!rel || isAbsolute(rel)) return null;
  const token = rel.replaceAll("\\", "/");
  if (!SAFE_ASS_PATH.test(token)) return null;
  return token;
}

export async function ensureExportFonts(fromDir: string, toDir: string): Promise<void> {
  await mkdir(toDir, { recursive: true });
  for (const name of await readdir(fromDir)) {
    const src = join(fromDir, name);
    const info = await stat(src);
    if (!info.isFile()) continue;
    const dest = join(toDir, name);
    try {
      const have = await stat(dest);
      if (have.isFile() && have.size === info.size && have.mtimeMs >= info.mtimeMs) continue;
    } catch {
      // 目的地還沒有這個檔。
    }
    await copyFile(src, dest);
  }
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
