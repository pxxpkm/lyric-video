import { basename, dirname, extname, join } from "node:path";

export function exportPartPath(outPath: string): string {
  const ext = extname(outPath).toLowerCase() === ".mp4" ? extname(outPath) : ".mp4";
  const base = basename(outPath, extname(outPath)).replace(/^\.+/, "").trim() || "歌詞影片";
  return join(dirname(outPath), `${base}.part${ext}`);
}

export function mp4FileName(title: string | null | undefined): string {
  const cleaned = (title ?? "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  const base = [...cleaned].slice(0, 80).join("").trim();
  return `${base || "歌詞影片"}.mp4`;
}
