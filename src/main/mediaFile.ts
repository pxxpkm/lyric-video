import { extname } from "node:path";

export function mediaType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case ".mp4":
    case ".m4v":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mkv":
      return "video/x-matroska";
    case ".mov":
      return "video/quicktime";
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".flac":
      return "audio/flac";
    case ".ogg":
      return "audio/ogg";
    case ".m4a":
      return "audio/mp4";
    case ".aac":
      return "audio/aac";
    case ".ttf":
      return "font/ttf";
    default:
      return "application/octet-stream";
  }
}

export function parseByteRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header || size <= 0) return null;
  const match = /bytes=(\d*)-(\d*)/i.exec(header);
  if (!match) return null;
  const startText = match[1] ?? "";
  const endText = match[2] ?? "";
  if (!startText && endText) {
    const suffix = Number(endText);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  if (!startText) return null;
  const start = Number(startText);
  if (!Number.isFinite(start) || start < 0 || start >= size) return null;
  const end = endText ? Number(endText) : size - 1;
  const safeEnd = Number.isFinite(end) ? Math.min(Math.max(start, end), size - 1) : size - 1;
  return { start, end: safeEnd };
}
