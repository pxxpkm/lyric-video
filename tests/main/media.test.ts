import { afterEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";
vi.mock("node:fs", () => ({ existsSync: vi.fn() }));
import { existsSync } from "node:fs";
import { importFailure, ytdlpCommand, ytdlpCookieArgs } from "../../src/main/media";
import { resourceRoot, studioRoot } from "../../src/main/paths";

afterEach(() => vi.resetAllMocks());

describe("yt-dlp 工具入口", () => {
  it("優先用專案獨立工具，沒有時沿用 PATH", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    expect(ytdlpCommand()).toBe(join(resourceRoot(), "tools", "yt-dlp.exe"));
    vi.mocked(existsSync).mockReturnValue(false);
    expect(ytdlpCommand()).toBe("yt-dlp");
  });
});

describe("YouTube 本機 Cookies", () => {
  it.each(["https://www.youtube.com/watch?v=test", "https://youtu.be/test", "https://music.youtube.com/watch?v=test"])("只向 YouTube 提供本機檔：%s", (url) => {
    vi.mocked(existsSync).mockReturnValue(true);
    expect(ytdlpCookieArgs(url)).toEqual(["--cookies", join(studioRoot(), "cookies.txt")]);
    vi.mocked(existsSync).mockReturnValue(false);
    expect(ytdlpCookieArgs(url)).toEqual([]);
  });
  it.each(["https://example.com/test", "https://youtube.com.example.com/test", "https://notyoutube.com/test", "invalid"])("其他連結不讀 Cookies：%s", (url) => {
    vi.mocked(existsSync).mockReturnValue(true);
    expect(ytdlpCookieArgs(url)).toEqual([]);
  });
});

describe("匯入失敗原因", () => {
  it.each([
    ["ERROR: Could not copy Chrome cookie database", "資料庫"],
    ["WARNING: failed to decrypt with DPAPI", "解密"],
    ["No Python at missing.exe", "無法啟動"],
    ["spawn yt-dlp ENOENT", "無法啟動"],
    ["Sign in to confirm you’re not a bot", "登入或驗證"],
    ["unrecognised private detail", "下載失敗"],
  ])("顯示可處理原因，唔暴露原始輸出：%s", (stderr, message) => {
    expect(importFailure(stderr)).toContain(message);
    expect(importFailure(stderr)).not.toContain(stderr);
  });
});
