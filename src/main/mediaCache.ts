import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export function youtubeId(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    const id = host === "youtu.be" ? parts[0]
      : host === "youtube.com" || host.endsWith(".youtube.com")
        ? url.pathname === "/watch" ? url.searchParams.get("v")
          : ["shorts", "embed", "live"].includes(parts[0]) ? parts[1] : null
        : null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export async function findCachedMedia(
  root: string,
  url: string,
  mode: "video" | "audio",
  probe: (path: string) => Promise<number | null>,
): Promise<{ mediaPath: string; durationMs: number } | null> {
  const id = youtubeId(url);
  if (!id) return null;
  let folders;
  try {
    folders = await readdir(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const folder of folders) {
    if (!folder.isDirectory() || !folder.name.startsWith("yt-")) continue;
    try {
      const project = JSON.parse(await readFile(join(root, folder.name, "project.json"), "utf8"));
      const source = project.source;
      if (source?.kind !== "youtube" || source.mode !== mode || youtubeId(source.url) !== id) continue;
      const path = source.mediaPath;
      if (typeof path !== "string" || /\.(part|ytdl|tmp)$/i.test(path)) continue;
      const file = await stat(path);
      if (!file.isFile() || file.size === 0) continue;
      const durationMs = await probe(path);
      if (durationMs != null && Number.isFinite(durationMs) && durationMs > 0) return { mediaPath: path, durationMs };
    } catch {
      // 舊專案或素材失效時繼續找，全部失效才重新下載。
    }
  }
  return null;
}
