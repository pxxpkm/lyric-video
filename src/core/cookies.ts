export type CookieStatus = { state: "missing" | "ready" | "expired" | "invalid"; count: number; message: string };

export function inspectNetscapeCookies(input: string, nowMs = Date.now()): CookieStatus {
  const invalid: CookieStatus = { state: "invalid", count: 0, message: "檔案不是有效的 Netscape Cookies 格式，請選擇匯出的 .txt 檔，不能直接使用 JSON。" };
  const text = input.replace(/^\uFEFF/, "");
  if (!/^#(?: Netscape)? HTTP Cookie File\s*(?:\r?\n|$)/.test(text) || text.includes("\0")) return invalid;
  let youtube = 0;
  let usable = 0;
  for (const row of text.split(/\r?\n/)) {
    if (!row.trim() || (row.startsWith("#") && !row.startsWith("#HttpOnly_"))) continue;
    const fields = row.replace(/^#HttpOnly_/, "").split("\t");
    if (fields.length !== 7) return invalid;
    const [domain, subdomains, path, secure, expires, name] = fields;
    if (!/^\.?[A-Za-z0-9.-]+$/.test(domain) || !["TRUE", "FALSE"].includes(subdomains) || !path.startsWith("/") || !["TRUE", "FALSE"].includes(secure) || !/^\d+$/.test(expires) || !Number.isSafeInteger(Number(expires)) || !name) return invalid;
    const host = domain.replace(/^\./, "").toLowerCase();
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") {
      youtube++;
      if (Number(expires) === 0 || Number(expires) > nowMs / 1000) usable++;
    }
  }
  if (!youtube) return { state: "invalid", count: 0, message: "檔案沒有 YouTube Cookies，請從已登入 YouTube 的瀏覽器匯出。" };
  if (!usable) return { state: "expired", count: 0, message: "YouTube Cookies 已過期，請重新匯出再選取。" };
  return { state: "ready", count: usable, message: `已設定（${usable} 個未過期的 YouTube Cookie）。登入狀態仍以 YouTube 實際回應為準。` };
}
