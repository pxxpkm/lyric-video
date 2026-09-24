import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export function logDir(appData = process.env.APPDATA ?? ""): string {
  if (!appData) throw new Error("找不到 APPDATA");
  return join(appData, "LyricVideoStudio");
}

export async function ensureLogDir(appData?: string): Promise<string> {
  const dir = logDir(appData);
  await mkdir(dir, { recursive: true });
  return dir;
}
