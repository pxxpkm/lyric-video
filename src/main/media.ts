import { runCommand, commandFailure } from "./commandRunner";
export { runCommand, type CommandResult } from "./commandRunner";
import { existsSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { readDownloadPercent, readFfprobeDuration, readYtdlpDump } from "../core/importPlan";
import { resourceRoot, studioRoot } from "./paths";
import { recordDownloadFiles } from "./downloadReceipt";

const FAIL = "下載失敗，請改拖本機檔。";

export function ytdlpCommand(): string {
  const local = join(resourceRoot(), "tools", "yt-dlp.exe");
  return existsSync(local) ? local : "yt-dlp";
}

export function ytdlpCookieArgs(url: string): string[] {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return [];
  }
  const youtube = hostname === "youtu.be" || hostname === "youtube.com" || hostname.endsWith(".youtube.com");
  const cookies = join(studioRoot(), "cookies.txt");
  return youtube && existsSync(cookies) ? ["--cookies", cookies] : [];
}

export function importFailure(stderr: string): string {
  if (/Could not copy Chrome cookie database/i.test(stderr)) {
    return "Chrome 的 Cookies 資料庫正被鎖住或無法讀取。請儲存工作後自行完整退出 Chrome 再試，或改拖本機檔。";
  }
  if (/decrypt.*DPAPI|DPAPI.*decrypt|app.bound/i.test(stderr)) {
    return "無法解密瀏覽器 Cookies。請改拖本機檔；不要停用瀏覽器保護。";
  }
  if (/No Python at|ENOENT/i.test(stderr)) {
    return "yt-dlp 無法啟動，請檢查工具安裝。亦可以改拖本機檔。";
  }
  if (/Sign in to confirm|login required|confirm you.re not a bot/i.test(stderr)) {
    return "YouTube 要求登入或驗證，暫時無法讀取。請在瀏覽器完成確認，再到首頁「YouTube 登入（選用）」選擇最新的 Netscape Cookies 檔；亦可以改拖本機檔。Cookies 不保證能通過驗證。";
  }
  return FAIL;
}

export async function probeUrl(url: string): Promise<
  { ok: true; id: string; title: string; uploader: string; durationMs: number | null } | { ok: false; error: string }
> {
  const result = await runCommand(ytdlpCommand(), [
    ...ytdlpCookieArgs(url),
    "--skip-download",
    "--no-playlist",
    "--no-warnings",
    "--dump-json",
    url,
  ], undefined, undefined, { timeoutMs: 60_000 });
  if (result.code !== 0) return { ok: false, error: commandFailure(result) ?? importFailure(result.stderr) };
  const dump = readYtdlpDump(result.stdout);
  if (!dump) return { ok: false, error: FAIL };
  return { ok: true, ...dump };
}

export async function probeFile(filePath: string): Promise<number | null> {
  const result = await runCommand("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    filePath,
  ], undefined, undefined, { timeoutMs: 30_000, maxOutputBytes: 1024 * 1024 });
  const failed = commandFailure(result);
  if (failed) throw new Error(failed);
  if (result.code !== 0) return null;
  return readFfprobeDuration(result.stdout);
}

export async function downloadUrl(
  url: string,
  directory: string,
  mode: "video" | "audio",
  onPercent?: (percent: number) => void,
): Promise<{ ok: true; mediaPath: string } | { ok: false; error: string }> {
  await mkdir(directory, { recursive: true });
  const args = [
    ...ytdlpCookieArgs(url),
    "--no-playlist",
    "--no-warnings",
    "--newline",
    "--windows-filenames",
    "-o",
    join(directory, "source.%(ext)s"),
    "--print",
    "after_move:FILE:%(filepath)s",
  ];
  if (mode === "audio") args.push("-f", "bestaudio/best");
  args.push(url);

  let buffer = "";
  const result = await runCommand(ytdlpCommand(), args, (chunk) => {
    buffer = (buffer + chunk).slice(-64 * 1024);
    const lines = buffer.split(/\r|\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const percent = readDownloadPercent(line);
      if (percent != null) onPercent?.(percent);
    }
  }, undefined, { timeoutMs: 2 * 60 * 60 * 1000, maxOutputBytes: 256 * 1024, stdoutMode: "tail" });
  await recordDownloadFiles(directory);
  if (result.code !== 0) return { ok: false, error: commandFailure(result) ?? importFailure(result.stderr) };

  const marked = [...result.stdout.matchAll(/^FILE:(.+)$/gm)].map((match) => match[1].trim());
  const printed = marked.filter((line) => line.length > 0).at(-1);
  if (printed) return { ok: true, mediaPath: printed };

  const names = await readdir(directory);
  const media = names.find((name) => name.startsWith("source."));
  if (!media) return { ok: false, error: FAIL };
  return { ok: true, mediaPath: join(directory, media) };
}

export { FAIL as IMPORT_FAIL };
