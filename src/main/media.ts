import { spawn } from "node:child_process";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { readDownloadPercent, readFfprobeDuration, readYtdlpDump } from "../core/importPlan";

const FAIL = "下載失敗，請改拖本機檔。";

export type CommandResult = { code: number; stdout: string; stderr: string };

export function runCommand(
  command: string,
  args: string[],
  onText?: (chunk: string) => void,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      onText?.(chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      onText?.(chunk);
    });
    child.on("error", (error) => {
      resolve({ code: -1, stdout, stderr: `${stderr}\n${error.message}` });
    });
    child.on("close", (code) => {
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

export async function probeUrl(url: string): Promise<
  { ok: true; id: string; title: string; uploader: string; durationMs: number | null } | { ok: false; error: string }
> {
  const result = await runCommand("yt-dlp", [
    "--skip-download",
    "--no-playlist",
    "--no-warnings",
    "--dump-json",
    url,
  ]);
  if (result.code !== 0) return { ok: false, error: FAIL };
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
  ]);
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
  const result = await runCommand("yt-dlp", args, (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r|\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const percent = readDownloadPercent(line);
      if (percent != null) onPercent?.(percent);
    }
  });
  if (result.code !== 0) return { ok: false, error: FAIL };

  const marked = [...result.stdout.matchAll(/^FILE:(.+)$/gm)].map((match) => match[1].trim());
  const printed = marked.filter((line) => line.length > 0).at(-1);
  if (printed) return { ok: true, mediaPath: printed };

  const names = await readdir(directory);
  const media = names.find((name) => name.startsWith("source."));
  if (!media) return { ok: false, error: FAIL };
  return { ok: true, mediaPath: join(directory, media) };
}

export { FAIL as IMPORT_FAIL };
