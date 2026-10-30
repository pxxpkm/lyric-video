import { expect, it } from "vitest";
import { inspectNetscapeCookies } from "../../src/core/cookies";

const header = "# Netscape HTTP Cookie File\n";
const row = (expiry: number, domain = ".youtube.com") => `${domain}\tTRUE\t/\tTRUE\t${expiry}\tFAKE_NAME\tfake-value`;

it("接受 Netscape、HttpOnly、BOM、CRLF 及未過期 session Cookie", () => {
  const value = "\uFEFF" + header.replace("\n", "\r\n") + "#HttpOnly_" + row(0) + "\r\n" + row(2000);
  expect(inspectNetscapeCookies(value, 1_000_000)).toMatchObject({ state: "ready", count: 2 });
});

it("區分已過期與沒有 YouTube 登入資料", () => {
  expect(inspectNetscapeCookies(header + row(500), 1_000_000).state).toBe("expired");
  expect(inspectNetscapeCookies(header + row(0, ".example.com")).state).toBe("invalid");
  expect(inspectNetscapeCookies(header + row(500) + "\n" + row(2000), 1_000_000)).toMatchObject({ state: "ready", count: 1 });
});

it.each(['[{"value":"fake-value"}]', row(0), header + "broken", header + row(0).replace("\tTRUE\t", "\tMAYBE\t"), header + row(0).replace("\t0\t", "\tNaN\t"), header + row(0) + "\0"])("格式錯誤不把內容帶到提示", (value) => {
  const result = inspectNetscapeCookies(value);
  expect(result.state).toBe("invalid");
  expect(result.message).not.toContain("fake-value");
  expect(result.message).not.toContain("FAKE_NAME");
});
