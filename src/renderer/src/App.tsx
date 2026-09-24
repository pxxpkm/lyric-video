import { useEffect, useState } from "react";
import type { ImportDraft, SaveRequest } from "../../shared/import";
import type { PreviewSession } from "../../shared/preview";
import { Preview } from "./Preview";

type Source = { kind: "youtube"; url: string } | { kind: "file"; path: string } | null;

function formatDuration(ms: number): string {
  if (ms <= 0) return "未知";
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function App() {
  const [status, setStatus] = useState("尚未匯入");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<Source>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [lockTitle, setLockTitle] = useState(false);
  const [lockArtist, setLockArtist] = useState(false);
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [mode, setMode] = useState<"video" | "audio">("video");
  const [error, setError] = useState("");
  const [savedPath, setSavedPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [screen, setScreen] = useState<"import" | "preview">("import");
  const [session, setSession] = useState<PreviewSession | null>(null);
  const [savedPreview, setSavedPreview] = useState<PreviewSession | null>(null);

  useEffect(() => {
    if (!window.lyric) {
      setError("畫面橋接沒有起來。");
      return;
    }
    return window.lyric.onProgress(setStatus);
  }, []);

  function fields() {
    return { lockTitle, lockArtist, title, artist };
  }

  function applyDraft(next: ImportDraft, nextSource: Source) {
    setSource(nextSource);
    setDraft(next);
    setTitle(next.title);
    setArtist(next.artist);
    setMode(next.mode);
    setError("");
    setSavedPath("");
    setStatus("已讀到標題，尚未下載");
  }

  async function readUrl() {
    setBusy(true);
    setError("");
    setStatus("正在讀取標題");
    try {
      const result = await window.lyric.probeUrl(url, fields());
      if (!result.ok) {
        setError(result.error);
        setStatus("尚未匯入");
        return;
      }
      applyDraft(result.draft, { kind: "youtube", url: url.trim() });
    } catch {
      setError("下載失敗，請改拖本機檔。");
      setStatus("尚未匯入");
    } finally {
      setBusy(false);
    }
  }

  async function readFile(file: File) {
    setBusy(true);
    setError("");
    setStatus(file.name);
    try {
      const path = window.lyric.pathForFile(file);
      if (!path) {
        setError("讀不到這個檔的路徑，請從檔案總管拖進來。");
        setStatus("尚未匯入");
        return;
      }
      const result = await window.lyric.probeFile(path, fields());
      if (!result.ok) {
        setError(result.error);
        setStatus("尚未匯入");
        return;
      }
      applyDraft(result.draft, { kind: "file", path });
      setStatus("已讀到標題，尚未建立專案");
    } catch {
      setError("讀不到這個檔，請改拖另一個本機檔。");
      setStatus("尚未匯入");
    } finally {
      setBusy(false);
    }
  }

  function request(): SaveRequest {
    return {
      title,
      artist,
      durationMs: draft?.durationMs ?? 0,
      mode,
      lockTitle,
      lockArtist,
    };
  }

  async function save() {
    if (!source) return;
    setBusy(true);
    setError("");
    try {
      const result =
        source.kind === "youtube"
          ? await window.lyric.downloadUrl(source.url, request())
          : await window.lyric.saveFile(source.path, request());
      if (!result.ok) {
        setError(result.error);
        setStatus(source.kind === "youtube" ? "下載失敗，請改拖本機檔。" : "尚未建立專案");
        return;
      }
      setSavedPath(result.projectPath);
      setSavedPreview({
        title,
        artist,
        mediaPath: result.mediaPath,
        projectPath: result.projectPath,
        mode,
        durationMs: draft?.durationMs ?? 0,
        lines: [],
        timing: { offsetMs: 0, rate: 1, lines: {}, holds: {}, texts: {}, trans: {}, added: [] },
      });
      setStatus("已建立專案，尚未匯出");
    } catch {
      setError("下載失敗，請改拖本機檔。");
    } finally {
      setBusy(false);
    }
  }

  async function openTestClip() {
    setBusy(true);
    setError("");
    try {
      setSession(await window.lyric.createTestClip());
      setScreen("preview");
    } catch {
      setError("測試片沒有建立。");
    } finally {
      setBusy(false);
    }
  }

  if (screen === "preview" && session) {
    return <Preview session={session} onBack={() => setScreen("import")} />;
  }

  return (
    <main>
      <h1>歌詞影片</h1>
      <p className="status">{status}</p>
      <div className="card">
        <label>
          連結
          <input
            type="url"
            value={url}
            placeholder="https://"
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
        <button type="button" disabled={busy || !url.trim()} onClick={() => void readUrl()}>
          讀取標題
        </button>
        <div
          className="drop"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            if (file) void readFile(file);
          }}
        >
          或把本機影音拖到這裡
        </div>
        <div className="row">
          <label>
            歌名
            <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="lock">
            <input type="checkbox" checked={lockTitle} onChange={(event) => setLockTitle(event.target.checked)} />
            鎖
          </label>
        </div>
        <div className="row">
          <label>
            歌手
            <input type="text" value={artist} onChange={(event) => setArtist(event.target.value)} />
          </label>
          <label className="lock">
            <input type="checkbox" checked={lockArtist} onChange={(event) => setLockArtist(event.target.checked)} />
            鎖
          </label>
        </div>
        <p className="meta">時長 {formatDuration(draft?.durationMs ?? 0)}</p>
        {draft?.note ? <p className="note">{draft.note}</p> : null}
        <label>
          畫面
          <select value={mode} onChange={(event) => setMode(event.target.value === "audio" ? "audio" : "video")}>
            <option value="video">保留畫面</option>
            <option value="audio">只要音訊</option>
          </select>
        </label>
        <button type="button" disabled={busy || !source} onClick={() => void save()}>
          {source?.kind === "youtube" ? "下載並建立專案" : "建立專案"}
        </button>
        <button
          type="button"
          disabled={busy || !savedPreview}
          onClick={() => {
            if (!savedPath) return;
            void window.lyric.loadProject(savedPath).then((loaded) => {
              setSession(loaded);
              setScreen("preview");
            });
          }}
        >
          預覽這個檔
        </button>
        <button type="button" disabled={busy} onClick={() => void openTestClip()}>
          打開測試片
        </button>
        {error ? <p className="error">{error}</p> : null}
        {savedPath ? <p className="meta">專案：{savedPath}</p> : null}
      </div>
    </main>
  );
}
