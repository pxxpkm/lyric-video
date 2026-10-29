import { useEffect, useState } from "react";
import type { CacheEntry } from "../../shared/cache";

const size = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function CacheLibrary({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<CacheEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function refresh() {
    setBusy(true);
    setError("");
    try { setRows(await window.lyric.listCache()); }
    catch { setError("讀不到下載素材，請稍後再試。"); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);
  async function remove(row?: CacheEntry) {
    setBusy(true);
    setError("");
    try {
      const message = row ? await window.lyric.trashCache(row.path) : await window.lyric.trashAllCache();
      setRows(await window.lyric.listCache());
      setError(message);
    } catch { setError("未能清除素材，請重新整理後再試。"); }
    finally { setBusy(false); }
  }
  return <main>
    <h1>下載素材</h1>
    <p>共 {rows.length} 個檔案，佔用 {size(rows.reduce((sum, row) => sum + row.bytes, 0))}。其中 {rows.filter((row) => row.clearable).length} 個可清除。未確認用途或已變更的檔案會保留。</p>
    <p>清除會將檔案移至資源回收筒，引用佢嘅專案將無法播放或匯出。專案設定會保留；重新新增連結會再下載。本機原片、Cookies 同匯出成片不在清除範圍。</p>
    <button disabled={busy} onClick={onClose}>返回</button>{" "}
    <button disabled={busy} onClick={() => void refresh()}>重新整理</button>
    {" "}<button disabled={busy || !rows.some((row) => row.clearable)} onClick={() => void remove()}>全部清除…</button>
    {busy ? <p role="status">處理中…</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    <div style={{ overflowX: "auto", marginTop: 16 }}>
      <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
        <thead><tr><th>素材</th><th>大小</th><th>更新時間</th><th>引用專案</th><th>操作</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.path}>
          <td style={{ padding: 10, overflowWrap: "anywhere" }} title={row.path}>{row.name}</td>
          <td style={{ whiteSpace: "nowrap" }}>{size(row.bytes)}</td>
          <td>{new Date(row.modified).toLocaleString("zh-HK")}</td>
          <td style={{ padding: 10 }}>{row.projects.length ? row.projects.map((name) => <div key={name}>{name}</div>) : "未找到引用專案"}</td>
          <td>{row.clearable ? <button disabled={busy} onClick={() => void remove(row)}>清除…</button> : <span title={row.reason}>保留（未確認／已變更）</span>}</td>
        </tr>)}</tbody>
      </table>
      {!busy && rows.length === 0 ? <p>沒有下載素材。</p> : null}
    </div>
  </main>;
}
