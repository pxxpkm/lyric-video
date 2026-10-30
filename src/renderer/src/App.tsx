import { useEffect, useState } from "react";
import type { ImportDraft, SaveRequest, ImportSource, SavedSourceProject } from "../../shared/import";
import type { MatchResult, PickList } from "../../shared/pick";
import type { PreviewSession } from "../../shared/preview";
import type { QueueJob } from "./lyric";
import { PickSong } from "./PickSong";
import { Preview } from "./Preview";
import { CacheLibrary } from "./CacheLibrary";
import { flushActiveSave } from "./projectSaver";
import { ImportProjectFlow } from "./importProjectFlow";

type Source = { kind: "youtube"; url: string } | { kind: "file"; path: string } | null;

function formatDuration(ms: number): string {
  if (ms <= 0) return "未知";
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function App() {
  const [importFlow] = useState(() => new ImportProjectFlow());
  const [existingChoices, setExistingChoices] = useState<{ source: ImportSource; request: SaveRequest; projects: SavedSourceProject[] } | null>(null);
  const [selectedProject, setSelectedProject] = useState("");
  const [showCache, setShowCache] = useState(false);
  const [returnToCache, setReturnToCache] = useState(false);
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
  const [toolActive, setToolActive] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [screen, setScreen] = useState<"import" | "preview" | "pick">("import");
  const [showTrans, setShowTrans] = useState(true);
  const [queueText, setQueueText] = useState("");
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [session, setSession] = useState<PreviewSession | null>(null);
  const [pick, setPick] = useState<PickList | null>(null);

  useEffect(() => window.lyric?.onCloseRequest(flushActiveSave), []);
  useEffect(() => window.lyric?.onToolState((state) => {
    if (state.kind === "import") { setToolActive(state.active); if (!state.active) setCancelling(false); }
  }), []);

  useEffect(() => {
    if (!window.lyric) return;
    void window.lyric.getSettings().then((settings) => setShowTrans(settings.showTrans));
    return window.lyric.onQueue(setJobs);
  }, []);

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
    importFlow.reset();
    setExistingChoices(null);
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
      const nextSource = { kind: "youtube" as const, url: url.trim() };
      const projects = await window.lyric.findSourceProjects(nextSource);
      if (projects.length) {
        const latest = projects[0];
        const nextDraft: ImportDraft = { title: latest.title, artist: latest.artist, durationMs: latest.durationMs, mode: latest.mode, useDuration: latest.durationMs > 0, note: "已找到本機專案，繼續編輯不需要重新下載或配詞。" };
        applyDraft(nextDraft, nextSource);
        setExistingChoices({ source: nextSource, request: { title: nextDraft.title, artist: nextDraft.artist, durationMs: nextDraft.durationMs, mode: nextDraft.mode, lockTitle, lockArtist }, projects });
        setSelectedProject(latest.projectPath);
        setStatus("找到已保存專案，請選擇繼續編輯或明確另建。");
        return;
      }
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

  const currentChoices = existingChoices && source && JSON.stringify([existingChoices.source, existingChoices.request]) === JSON.stringify([source, request()]) ? existingChoices : null;

  async function save(createNew = false) {
    if (!source) return;
    setBusy(true);
    setError("");
    try {
      setStatus(importFlow.existingPath(source, request()) ? "正在讀取已保存專案" : "正在建立專案及搜尋歌詞");
      const found = await importFlow.open(source, request(), window.lyric, createNew);
      if (!("ok" in found) && found.kind === "existing-projects") {
        setExistingChoices({ source, request: request(), projects: found.projects });
        setSelectedProject(found.projects[0].projectPath);
        setStatus("找到同一來源的已保存專案，請選擇繼續編輯或明確另建。");
      } else showMatch(found);
    } catch {
      setError("未能開啟或建立專案，請再試；已有專案不會重新初始化。");
    } finally {
      const path = importFlow.existingPath(source, request());
      if (path) setSavedPath(path);
      setBusy(false);
    }
  }

  async function openTestClip() {
    setBusy(true);
    setError("");
    try {
      setSession(await window.lyric.enqueueTest());
      setScreen("preview");
    } catch {
      setError("測試片沒有建立。");
    } finally {
      setBusy(false);
    }
  }

  function showMatch(found: MatchResult | { ok: false; error: string } | null): void {
    if (!found) return;
    if ("ok" in found) {
      setError(found.error);
      setStatus("未能開啟專案，原有設定仍保留。");
      return;
    }
    setError("");
    setExistingChoices(null);
    setSession(found.session);
    setSavedPath(found.session.projectPath);
    if (found.kind === "pick") {
      setPick(found.pick);
      setScreen("pick");
      setStatus(found.pick.reason || "選擇歌詞");
      return;
    }
    setPick(null);
    setScreen("preview");
    setStatus(found.session.lines.length > 0 ? "可預覽" : "尚未有歌詞");
  }

  function returnFromEditor() {
    setScreen("import");
    if (returnToCache) setShowCache(true);
    setReturnToCache(false);
  }

  if (screen === "preview" && session) {
    return (
      <Preview
        key={session.projectPath}
        session={session}
        showTrans={showTrans}
        onBack={returnFromEditor}
        onPick={async () => {
          setBusy(true);
          setError("");
          try { showMatch(await window.lyric.browseProject(session.projectPath, null)); }
          finally { setBusy(false); }
        }}
      />
    );
  }

  if (screen === "pick" && session && pick) {
    return (
      <PickSong
        key={`${pick.reason}|${pick.hits.map((hit) => hit.key).join("|")}`}
        pick={pick}
        busy={busy}
        error={error}
        onBack={returnFromEditor}
        onSkip={() => {
          setScreen("preview");
          setStatus(session.lines.length > 0 ? "可預覽" : "尚未有歌詞");
        }}
        onSearch={(fields) => {
          setBusy(true);
          setError("");
          void window.lyric
            .browseProject(session.projectPath, fields)
            .then(showMatch)
            .finally(() => setBusy(false));
        }}
        onUse={(key, remember) => {
          setBusy(true);
          setError("");
          void window.lyric
            .useCandidate(session.projectPath, key, remember)
            .then(showMatch)
            .finally(() => setBusy(false));
        }}
      />
    );
  }

  if (showCache) return <CacheLibrary onClose={() => setShowCache(false)} onOpenProject={async (path) => {
    const found = await window.lyric.resumeProject(path);
    if ("ok" in found) throw new Error(found.error);
    showMatch(found);
    setReturnToCache(true);
    setShowCache(false);
  }} />;

  return (
    <main>
      <h1>歌詞影片</h1>
      <button disabled={busy || jobs.some((job) => job.status === "running" || job.status === "waiting")} onClick={() => setShowCache(true)}>下載素材／清除緩存</button>
      <p className="status">{status}</p>
      {toolActive ? <button disabled={cancelling} onClick={() => {
        setCancelling(true); setStatus("正在停止工具，請稍候…");
        void window.lyric.cancelTool("import").catch(() => { setCancelling(false); setError("未能發出取消，請再試。"); });
      }}>{cancelling ? "正在取消" : "取消讀取／下載"}</button> : null}
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
          讀取／找回專案
        </button>
        <div
          className="drop"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (busy) return;
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
        <button type="button" disabled={busy || !source || !!currentChoices} onClick={() => void save()}>
          {source && importFlow.existingPath(source, request()) ? "繼續編輯專案" : "開啟或建立專案"}
        </button>
        <p className="meta">會先找回同一來源的已保存專案；另建新專案才使用初始設定，原專案保留。</p>
        {currentChoices ? <section className="card" aria-label="選擇已保存專案">
          <h2>找到已保存專案</h2>
          <p>如之前已編輯過，請選擇原本嗰份。按最近保存時間排序，列出字級及延遲方便辨認；開啟不會重新配詞或重設。</p>
          <label>專案<select disabled={busy} value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)}>
            {currentChoices.projects.map((project) => <option key={project.projectPath} value={project.projectPath}>
              {project.title || "未命名"} · {new Date(project.modified).toLocaleString("zh-HK")} · {project.mode === "video" ? "影片" : "音訊"} · 字級 {project.fontSize} · 延遲 {project.offsetMs}ms · {project.projectPath.split(/[\\/]/).slice(-2, -1)[0]}
            </option>)}
          </select></label>
          {currentChoices.projects.filter((project) => project.projectPath === selectedProject).map((project) => <p className="meta" key={project.projectPath}>專案：{project.projectPath}；歌詞 {project.lyricCount} 句。{project.mediaAvailable ? "" : "來源檔遺失，設定仍在；繼續編輯時會先找本機副本，YouTube 來源無副本就重新下載。"}</p>)}
          <button disabled={busy || !selectedProject} onClick={async () => {
            if (!currentChoices.projects.some((project) => project.projectPath === selectedProject)) return;
            setBusy(true); setError("");
            try {
              const found = await importFlow.continueWith(currentChoices.source, currentChoices.request, selectedProject, window.lyric);
              if (!("ok" in found) && found.kind === "existing-projects") return;
              showMatch(found);
            } catch { setError("讀不到選定專案，沒有另建或重設。請再試或選另一份。"); }
            finally { setBusy(false); }
          }}>繼續編輯選定專案</button>{" "}
          <button disabled={busy} onClick={() => void save(true)}>另建新專案（初始設定）</button>{" "}
          <button disabled={busy} onClick={() => setExistingChoices(null)}>取消</button>
        </section> : null}
        <button
          type="button"
          disabled={busy || !savedPath}
          onClick={async () => {
            if (!savedPath) return;
            setBusy(true);
            try { showMatch(await window.lyric.resumeProject(savedPath)); }
            catch { setError("讀不到已保存專案，請確認檔案仍在後再試。"); }
            finally { setBusy(false); }
          }}
        >
          預覽這個檔
        </button>
        <button type="button" disabled={busy} onClick={() => void openTestClip()}>
          打開測試片
        </button>
        <div className="row">
          <label className="lock">
            <input type="checkbox" checked disabled />
            轉繁體
          </label>
          <label className="lock">
            <input
              type="checkbox"
              checked={showTrans}
              onChange={(event) => {
                const next = event.target.checked;
                setShowTrans(next);
                void window.lyric.setShowTrans(next);
              }}
            />
            顯示譯文
          </label>
          <label className="lock">
            <input type="checkbox" checked={false} disabled />
            羅馬字（稍後）
          </label>
        </div>
        <label>
          佇列（每行一條網址）
          <textarea value={queueText} rows={3} onChange={(event) => setQueueText(event.target.value)} />
        </label>
        <button
          type="button"
          disabled={!queueText.trim()}
          onClick={() => {
            void window.lyric.enqueueUrls(queueText).then(setJobs);
            setQueueText("");
          }}
        >
          排入佇列
        </button>
        <div className="queue">
          {jobs.length === 0 ? <p className="meta">尚未排入</p> : null}
          {jobs.map((job) => <div key={job.id}>
            <button
              key={job.id}
              type="button"
              className="queue-item"
              disabled={job.status !== "ready"}
              onClick={() => {
                if (busy) return;
                setBusy(true);
                void window.lyric.openJob(job.id).then(showMatch).catch((error: unknown) => setError(error instanceof Error ? error.message : "讀不到最新專案，請確認檔案仍在，然後再試。")).finally(() => setBusy(false));
              }}
            >
              <span>
                {job.label} · {job.message}
              </span>
            </button>
            {job.status === "running" || job.status === "waiting" ? <button onClick={() => void window.lyric.cancelQueueJob(job.id).then(setJobs)}>取消</button> : null}
            {job.status === "failed" || job.status === "cancelled" ? <button onClick={() => void window.lyric.retryQueueJob(job.id).then(setJobs)}>重試</button> : null}
          </div>)}
        </div>
        {error ? <p className="error">{error}</p> : null}
        {savedPath ? <p className="meta">專案：{savedPath}</p> : null}
      </div>
    </main>
  );
}
