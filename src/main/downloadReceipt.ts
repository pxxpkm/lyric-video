import { lstat, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const RECEIPT = "download-files.json";

// 只在本程式建立的新下載資料夾、下載程序結束時記錄；日後不靠檔名擴大清除範圍。
export async function recordDownloadFiles(directory: string): Promise<void> {
  const files = [];
  for (const name of await readdir(directory)) {
    if (!name.startsWith("source.")) continue;
    const info = await lstat(join(directory, name));
    if (info.isFile() && !info.isSymbolicLink()) files.push({ name, bytes: info.size, modifiedMs: info.mtimeMs });
  }
  await writeFile(join(directory, RECEIPT), JSON.stringify({ version: 1, files }), "utf8");
}
