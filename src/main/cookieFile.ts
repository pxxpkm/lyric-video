import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { inspectNetscapeCookies, type CookieStatus } from "../core/cookies";
import { studioRoot } from "./paths";

const MAX_COOKIE_BYTES = 8 * 1024 * 1024;
const cookiePath = () => join(studioRoot(), "cookies.txt");

async function readCookies(path: string): Promise<string> {
  const info = await stat(path);
  if (!info.isFile() || info.size > MAX_COOKIE_BYTES) throw new Error("Cookies 檔案必須是 8 MB 以內的普通文字檔。");
  const bytes = await readFile(path);
  if (bytes.length > MAX_COOKIE_BYTES) throw new Error("Cookies 檔案超出大小上限。");
  return bytes.toString("utf8");
}

export async function cookieStatus(): Promise<CookieStatus> {
  try { return inspectNetscapeCookies(await readCookies(cookiePath())); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { state: "missing", count: 0, message: "未設定。可以先直接下載；YouTube 要求登入時再匯入 Cookies，或改拖本機檔。" };
    return { state: "invalid", count: 0, message: "未能讀取 Cookies 檔，請重新選取有效的 Netscape .txt 檔。" };
  }
}

export async function importCookieFile(sourcePath: string): Promise<CookieStatus> {
  const text = await readCookies(sourcePath);
  const status = inspectNetscapeCookies(text);
  if (status.state !== "ready") throw new Error(status.message);
  const target = cookiePath();
  if (resolve(sourcePath).toLowerCase() === resolve(target).toLowerCase()) return status;
  await mkdir(dirname(target), { recursive: true });
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, text.replace(/^\uFEFF/, ""), { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temp, target);
  } finally { await rm(temp, { force: true }); }
  return status;
}

export async function clearCookieFile(): Promise<CookieStatus> {
  await rm(cookiePath(), { force: true });
  return cookieStatus();
}
