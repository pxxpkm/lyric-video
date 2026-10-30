import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { cookieStatus, importCookieFile, clearCookieFile } from "../../src/main/cookieFile";
import { setRoots } from "../../src/main/paths";

const dirs: string[] = [];
const valid = "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tFAKE_NAME\tfake-value\n";
afterEach(async () => {
  setRoots({ studio: () => join(process.cwd(), "studio-data"), resources: () => process.cwd() });
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "lyric-cookies-")); dirs.push(dir);
  const studio = join(dir, "studio");
  setRoots({ studio: () => studio, resources: () => process.cwd() });
  const source = join(dir, "export.txt");
  await writeFile(source, valid);
  return { dir, studio, source };
}

it("匯入及清除只處理程式副本，不改原檔，不回傳 Cookie 內容", async () => {
  const f = await fixture();
  expect((await cookieStatus()).state).toBe("missing");
  const status = await importCookieFile(f.source);
  expect(status.state).toBe("ready");
  expect(JSON.stringify(status)).not.toContain("fake-value");
  expect(await readFile(join(f.studio, "cookies.txt"), "utf8")).toBe(valid);
  expect((await clearCookieFile()).state).toBe("missing");
  expect(await readFile(f.source, "utf8")).toBe(valid);
});

it("錯誤、過期及過大檔案不覆蓋已設定副本", async () => {
  const f = await fixture();
  await importCookieFile(f.source);
  for (const content of ['{"cookies":[]}', valid.replace("\t0\t", "\t1\t"), "x".repeat(8 * 1024 * 1024 + 1)]) {
    await writeFile(f.source, content);
    await expect(importCookieFile(f.source)).rejects.toThrow();
    expect(await readFile(join(f.studio, "cookies.txt"), "utf8")).toBe(valid);
  }
  expect(await readdir(f.studio)).toEqual(["cookies.txt"]);
});

it("舊手動檔案仍可讀，同一檔案選取不重寫，缺檔與壞檔分開提示", async () => {
  const f = await fixture(); await importCookieFile(f.source);
  const target = join(f.studio, "cookies.txt");
  expect((await importCookieFile(target)).state).toBe("ready");
  await writeFile(target, "invalid");
  expect((await cookieStatus()).state).toBe("invalid");
  await rm(target);
  expect((await cookieStatus()).state).toBe("missing");
});
