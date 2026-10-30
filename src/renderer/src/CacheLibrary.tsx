import { useEffect, useState } from "react";
import type { CacheEntry } from "../../shared/cache";

const size = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function CacheLibrary({ onClose, onOpenProject }: { onClose: () => void; onOpenProject: (path: string) => Promise<void> }) {
  const [rows, setRows] = useState<CacheEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  useEffect(() => window.lyric.onProgress(setProgress), []);
  async function refresh() {
    setBusy(true);
    setProgress("");
    setError("");
    try { setRows(await window.lyric.listCache()); }
    catch { setError("讀不到下載素材，請稍後再試。"); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);
  async function remove(row?: CacheEntry) {
    setBusy(true);
    setProgress("");
    setError("");
    try {
      const message = row ? await window.lyric.trashCache(row.path) : await window.lyric.trashAllCache();
      setRows(await window.lyric.listCache());
      setError(message);
    } catch { setError("未能清除素材，請重新整理後再試。"); }
    finally { setBusy(false); }
  }
  async function edit(path: string) {
    setBusy(true); setError(""); setProgress("正在檢查專案來源素材…");
    try { await onOpenProject(path); }
    catch (error) { setError(error instanceof Error ? error.message : "讀不到這份專案，請重新整理後再試；沒有建立或重設專案。"); }
    finally { setBusy(false); }
  }
  return <main>
    <h1>下載素材</h1>
    <p>撳引用專案旁邊嘅「編輯」可繼續製作。共用素材嘅不同專案各自保留設定，請揀返要編輯嗰份。</p>
    <p>共 {rows.length} 個檔案，佔用 {size(rows.reduce((sum, row) => sum + row.bytes, 0))}。其中 {rows.filter((row) => row.clearable).length} 個可清除。未確認用途或已變更的檔案會保留。</p>
    <p>清除會將來源檔移至資源回收筒，專案設定保留。YouTube 專案下次編輯時會先找本機副本，冇先重新下載並接回原專案。本機原片、Cookies 同匯出成片不在清除範圍。</p>
    <button disabled={busy} onClick={onClose}>返回</button>{" "}
    <button disabled={busy} onClick={() => void refresh()}>重新整理</button>
    {" "}<button disabled={busy || !rows.some((row) => row.clearable)} onClick={() => void remove()}>全部清除…</button>
    {busy ? <p role="status">{progress || "處理中…"}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    <div style={{ overflowX: "auto", marginTop: 16 }}>
      <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
        <thead><tr><th>素材</th><th>大小</th><th>更新時間</th><th>引用專案</th><th>操作</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.path}>
          <td style={{ padding: 10, overflowWrap: "anywhere" }} title={row.path}>{row.name}</td>
          <td style={{ whiteSpace: "nowrap" }}>{size(row.bytes)}</td>
          <td>{new Date(row.modified).toLocaleString("zh-HK")}</td>
          <td style={{ padding: 10 }}>{row.projects.length ? row.projects.map((name) => {
            const link = row.projectLinks?.find((project) => project.label === name);
            return <div key={name} style={{ marginBottom: 6 }}>{name}{" "}{link
              ? <button disabled={busy} title={link.projectPath} onClick={() => void edit(link.projectPath)}>編輯</button>
              : <span>（專案未能讀取）</span>}</div>;
          }) : "未找到引用專案"}</td>
          <td>{row.clearable ? <button disabled={busy} onClick={() => void remove(row)}>清除…</button> : <span title={row.reason}>保留（未確認／已變更）</span>}</td>
        </tr>)}</tbody>
      </table>
      {!busy && rows.length === 0 ? <p>沒有下載素材。</p> : null}
    </div>
  </main>;
}
