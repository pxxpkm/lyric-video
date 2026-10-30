import { realpath, rename, stat } from "node:fs/promises";
import { resolve } from "node:path";

function pathKey(path: string): string {
  const full = resolve(path);
  return process.platform === "win32" ? full.toLowerCase() : full;
}

export async function assertExportDestination(mediaPath: string, outPath: string): Promise<void> {
  if (pathKey(mediaPath) === pathKey(outPath)) throw new Error("匯出位置不能是來源影音，請選另一個檔名。");
  const source = await realpath(mediaPath);
  let target: string;
  try {
    target = await realpath(outPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  const [a, b] = await Promise.all([stat(source, { bigint: true }), stat(target, { bigint: true })]);
  if (pathKey(source) === pathKey(target) || (a.ino !== 0n && a.ino === b.ino && a.dev === b.dev)) {
    throw new Error("匯出位置不能是來源影音，請選另一個檔名。");
  }
  if (!b.isFile()) throw new Error("匯出位置不是普通檔案，請選另一個位置。");
}

export async function publishExport(part: string, outPath: string, mediaPath: string): Promise<void> {
  await assertExportDestination(mediaPath, outPath);
  // 暫存與目的檔在同一資料夾。直接 rename 替換；失敗時不可先刪舊成片。
  await rename(part, outPath);
}
