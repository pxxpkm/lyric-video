import { useEffect, useState } from "react";
import type { CookieStatus } from "../../core/cookies";

export function CookieSettings({ disabled, onBusy }: { disabled: boolean; onBusy: (busy: boolean) => void }) {
  const [status, setStatus] = useState<CookieStatus | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    void window.lyric.cookieStatus().then(value => { if (mounted) setStatus(value); }).catch(() => { if (mounted) setError("未能讀取 Cookies 狀態。"); });
    return () => { mounted = false; };
  }, []);
  async function change(clear: boolean) {
    setWorking(true); onBusy(true); setError("");
    try {
      const result = await (clear ? window.lyric.clearCookies() : window.lyric.selectCookies());
      if (result.ok) setStatus(result.status);
      else if (!result.cancelled) setError(result.error || "未能更改 Cookies，原有檔案已保留。");
    } catch { setError("未能更改 Cookies，請稍後再試。"); }
    finally { setWorking(false); onBusy(false); }
  }
  const label = status ? { missing: "未設定", ready: "已設定", expired: "已過期", invalid: "需要重新選取" }[status.state] : "讀取中";
  return <details className="cookie-settings" aria-label="YouTube 登入設定">
    <summary>YouTube 登入（選用） · {label}</summary>
    <div className="card">
    <p className="meta">冇 Cookies 亦可以先試下載。YouTube 要求登入時，請先在瀏覽器完成確認，再選擇已匯出的 Netscape .txt Cookies 檔；亦可改拖本機影音。</p>
    <p role="status">{status ? status.message : "正在讀取 Cookies 狀態…"}</p>
    <button disabled={disabled || working} onClick={() => void change(false)}>選擇 Cookies 檔…</button>{" "}
    <button disabled={disabled || working || status?.state === "missing" || status == null} onClick={() => void change(true)}>清除程式副本…</button>
    <p className="meta">檔案只保存喺本機，供 YouTube 下載工作使用；不顯示內容、不會隨安裝包發佈。Cookies 等同登入憑證，請勿分享。匯入不代表一定能通過 YouTube 驗證。</p>
    {error ? <p role="alert" className="error">{error}</p> : null}
    </div>
  </details>;
}
