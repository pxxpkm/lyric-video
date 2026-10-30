import { memo, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { ProjectSaver, registerActiveSave, type SaveStatus } from "./projectSaver";
import { alignLyricPositions, moveLyricPositions, restoreLyricPositions, type PositionTarget, type PositionLine } from "../../core/positionEditing";
import { drawPreview, mediaKeepsPainting, previewPaintKey, readoutFrame, sessionLines, shouldPaintPreview } from "./drawPreview";
import { ShapePanel } from "./ShapePanel";
import { TimingPanel } from "./TimingPanel";
import { lyricClockMs, mediaMsForLyric, previewFrame } from "../../core/preview";
import { mediaSpans, type MotionClip } from "../../core/motion";
import { timeOfMs, type LyricLine } from "../../core/lyrics";
import { clampLook, type LyricLook } from "../../core/lyricLook";
import { timingForProject, timingFromProject } from "../../core/projectTiming";
import type { TrackTiming } from "../../core/timing";
import { mediaSrc, type PreviewSession } from "../../shared/preview";
import { BackIcon, IconButton, PauseIcon, PlayIcon } from "./icons";
import { SeekBar } from "./SeekBar";

function activeMedia(video: HTMLVideoElement | null, audio: HTMLAudioElement | null): HTMLMediaElement | null {
  return video ?? audio;
}

let chironLoaded: Promise<void> | null = null;

function ensureChiron(): Promise<void> {
  chironLoaded ??= window.lyric
    .chironFont()
    .then(async (bytes) => {
      const face = new FontFace("Chiron GoRound TC", bytes);
      document.fonts.add(await face.load());
    })
    .catch(() => undefined);
  return chironLoaded;
}

export function Preview({
  session,
  showTrans,
  onBack,
  onPick,
}: {
  session: PreviewSession;
  showTrans: boolean;
  onBack: () => void;
  onPick?: () => Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const readRef = useRef<HTMLParagraphElement | null>(null);
  const linesRef = useRef(sessionLines(session.lines));
  const debugRef = useRef(true);
  const [timing, setTiming] = useState<TrackTiming>(() => timingFromProject(session.timing));
  const timingRef = useRef(timing);
  const [look, setLook] = useState<LyricLook>(() => clampLook(session.look));
  const lookRef = useRef(look);
  const [clips, setClips] = useState<MotionClip[]>(() => session.motion ?? []);
  const clipsRef = useRef(clips);
  const [dragScope, setDragScope] = useState<"song" | "line">("song");
  const [dragTarget, setDragTarget] = useState<PositionTarget>("orig");
  const [positionUndo, setPositionUndo] = useState<{ look: LyricLook; clips: MotionClip[]; target: PositionTarget } | null>(null);
  const dragRef = useRef<{ id: number; scope: "song" | "line"; target: PositionTarget; x: number; y: number; origin: LyricLook; clips: MotionClip[]; line: PositionLine | null } | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [pick, setPick] = useState(0);
  const [pane, setPane] = useState<"text" | "shape">("text");
  const [debug, setDebug] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingAss, setSavingAss] = useState(false);
  const [exportText, setExportText] = useState("");
  const [pos, setPos] = useState(0);
  const kickPaint = useRef<() => void>(() => {});
  const [duration, setDuration] = useState(session.durationMs / 1000);
  const src = mediaSrc(session.mediaPath);
  const hasLyrics = session.lines.length > 0;
  const allowPick = !session.projectPath.replaceAll("\\", "/").endsWith("/test-clip/project.json");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [saver] = useState(() => new ProjectSaver(
    { timing: timingForProject(timing), look, motion: clips },
    async (value) => {
      const ok = await window.lyric.saveTiming(session.projectPath, value.timing, value.look, value.motion);
      if (!ok) throw new Error("保存失敗");
    },
  ));

  function saveLatest() {
    saver.update({ timing: timingForProject(timingRef.current), look: lookRef.current, motion: clipsRef.current });
    return saver.flush();
  }

  async function leave(action: () => void | Promise<void>) {
    if (leaving) return;
    setLeaving(true);
    setLeaveError("");
    try { if (await saveLatest()) await action(); }
    catch { setLeaveError("未能開啟歌詞選擇，修改已保存，請再試。"); }
    finally { setLeaving(false); }
  }

  useLayoutEffect(() => {
    linesRef.current = sessionLines(session.lines).map((line) =>
      showTrans ? line : { ...line, translatedText: null },
    );
    debugRef.current = debug;
    timingRef.current = timing;
    // 拖緊個 ref 已經係最新位置。用呢次渲染嘅舊值蓋住，鬆手會彈返拖之前。
    if (dragRef.current == null) {
      lookRef.current = look;
      clipsRef.current = clips;
    }
  }, [session, debug, timing, showTrans, look, clips]);

  useEffect(() => {
    const next = clampLook(session.look);
    lookRef.current = next;
    setLook(next);
    const nextClips = session.motion ?? [];
    clipsRef.current = nextClips;
    setClips(nextClips);
    setSelectedKey(null);
    setPick((value) => value + 1);
  }, [session]);

  useEffect(() => window.lyric.onExportProgress(setExportText), []);
  useEffect(() => { if (look.showOriginal === false && dragTarget === "orig") setDragTarget("trans"); }, [look.showOriginal, dragTarget]);

  useEffect(() => saver.subscribe(setSaveStatus), [saver]);
  useLayoutEffect(() => {
    saver.update({ timing: timingForProject(timing), look, motion: clips });
  }, [timing, look, clips, saver]);
  useEffect(() => registerActiveSave(saveLatest), [saver]);
  useEffect(() => {
    const warnUnload = (event: BeforeUnloadEvent) => {
      if (saver.status === "saved") return;
      event.preventDefault();
      event.returnValue = "尚有修改未保存";
    };
    window.addEventListener("beforeunload", warnUnload);
    return () => window.removeEventListener("beforeunload", warnUnload);
  }, [saver]);

  useEffect(() => {
    void ensureChiron();
  }, []);

  useEffect(() => {
    let frame = 0;
    let stopped = false;
    let forceNext = true;
    let lastKey: string | null = null;
    let lastAt = 0;
    let lastRead = 0;
    const writeReadout = (posMs: number, painted: ReturnType<typeof drawPreview> | null, paintedNow: boolean) => {
      const read = readRef.current;
      if (!read) return;
      const show = debugRef.current;
      if (read.hidden === show) read.hidden = !show;
      if (!show) return;
      const now = performance.now();
      if (!paintedNow && now - lastRead < 200) return;
      const timingNow = timingRef.current;
      const shown = painted ?? readoutFrame(linesRef.current, posMs, timingNow);
      lastRead = now;
      const lyricMs = lyricClockMs(posMs, timingNow.offsetMs, timingNow.rate);
      const lineMs = mediaMsForLyric(shown.atMs, timingNow.offsetMs, timingNow.rate);
      const cells = read.querySelectorAll("span");
      const next = [
        `播放 ${readClock(posMs)}`,
        `歌詞 ${readClock(lyricMs)}`,
        `呢句 ${shown.text ? readClock(lineMs) : "—"}`,
        `第 ${shown.wordIndex >= 0 ? shown.wordIndex + 1 : "—"} 字`,
      ];
      cells.forEach((cell, index) => {
        if (cell.textContent !== next[index]) cell.textContent = next[index];
      });
    };
    const paint = (now: number) => {
      const canvas = canvasRef.current;
      const media = activeMedia(videoRef.current, audioRef.current);
      const posMs = media ? media.currentTime * 1000 : 0;
      const key = previewPaintKey(
        linesRef.current,
        posMs,
        session.mode,
        timingRef.current,
        lookRef.current,
        clipsRef.current,
        canvas?.clientWidth ?? 0,
        canvas?.clientHeight ?? 0,
      );
      const forced = forceNext;
      forceNext = false;
      // 字停住就唔好清畫布。郁緊先隔大約 33 毫秒畫一次。跳時間、拖、改外觀會即刻畫。
      const paintedNow = canvas != null && shouldPaintPreview({ now, lastAt, key, previousKey: lastKey, forced });
      const painted = paintedNow
        ? drawPreview(canvas, linesRef.current, posMs, session.mode, timingRef.current, lookRef.current, clipsRef.current)
        : null;
      if (paintedNow) {
        lastKey = key;
        lastAt = now;
      }
      writeReadout(posMs, painted, paintedNow);
    };
    const loop = (now: number) => {
      if (stopped) return;
      paint(now);
      const media = activeMedia(videoRef.current, audioRef.current);
      // 暫停再排下一幀的話，視窗返到最前都仍然每幀佔 GPU。
      if (dragRef.current != null || mediaKeepsPainting(media)) frame = requestAnimationFrame(loop);
    };
    const kick = () => {
      if (stopped) return;
      forceNext = true;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(loop);
    };
    kickPaint.current = kick;
    const nodes = [videoRef.current, audioRef.current];
    for (const node of nodes) {
      node?.addEventListener("play", kick);
      node?.addEventListener("pause", kick);
      node?.addEventListener("seeked", kick);
      node?.addEventListener("ended", kick);
    }
    const canvas = canvasRef.current;
    let boxW = canvas?.clientWidth ?? 0;
    let boxH = canvas?.clientHeight ?? 0;
    const observer = canvas
      ? new ResizeObserver(() => {
          const node = canvasRef.current;
          if (!node) return;
          const nextW = node.clientWidth;
          const nextH = node.clientHeight;
          if (Math.abs(nextW - boxW) < 2 && Math.abs(nextH - boxH) < 2) return;
          boxW = nextW;
          boxH = nextH;
          kick();
        })
      : null;
    if (canvas) observer?.observe(canvas);
    const onFont = () => kick();
    document.fonts.addEventListener("loadingdone", onFont);
    window.addEventListener("resize", kick);
    kick();
    return () => {
      stopped = true;
      kickPaint.current = () => {};
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.fonts.removeEventListener("loadingdone", onFont);
      window.removeEventListener("resize", kick);
      for (const node of nodes) {
        node?.removeEventListener("play", kick);
        node?.removeEventListener("pause", kick);
        node?.removeEventListener("seeked", kick);
        node?.removeEventListener("ended", kick);
      }
    };
  }, [session.mode]);

  useEffect(() => {
    kickPaint.current();
  }, [look, timing, clips, session.lines, showTrans, debug, session.mode]);

  function replay(line: LyricLine) {
    const media = activeMedia(videoRef.current, audioRef.current);
    if (!media) return;
    const lyric = Math.max(0, timeOfMs(line, timing.lines) - 2_000);
    media.currentTime = mediaMsForLyric(lyric, timing.offsetMs, timing.rate) / 1000;
    void media.play();
  }

  function exportBody() {
    return {
      projectPath: session.projectPath,
      mediaPath: session.mediaPath,
      mode: session.mode,
      durationMs: session.durationMs,
      lines: showTrans ? session.lines : session.lines.map((line) => ({ ...line, trans: "" })),
      timing: timingForProject(timing),
      look,
      motion: clips,
      title: session.title,
    };
  }

  async function exportVideo() {
    setExporting(true);
    setExportText("正在寫字幕");
    try {
      const result = await window.lyric.exportVideo(exportBody());
      if ("cancelled" in result && result.cancelled) {
        setExportText("");
        return;
      }
      setExportText(result.ok ? result.outPath : result.error);
    } catch {
      setExportText("匯出失敗");
    } finally {
      setExporting(false);
    }
  }

  async function exportAss() {
    setSavingAss(true);
    setExportText("正在寫字幕");
    try {
      const result = await window.lyric.exportAss(exportBody());
      if ("cancelled" in result && result.cancelled) {
        setExportText("");
        return;
      }
      setExportText(result.ok ? result.outPath : result.error);
    } catch {
      setExportText("ASS 未能寫入");
    } finally {
      setSavingAss(false);
    }
  }

  function chooseLine(key: string) {
    setSelectedKey(key);
    setPick((value) => value + 1);
  }

  function beginDrag(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const media = activeMedia(videoRef.current, audioRef.current);
    const mediaMs = media ? media.currentTime * 1000 : 0;
    const frame = readoutFrame(linesRef.current, mediaMs, timingRef.current);
    const span = frame.key ? mediaSpans(linesRef.current, timingRef.current).get(frame.key) : undefined;
    const line = frame.key && span ? { key: frame.key, text: frame.text, startMs: span.startMs, endMs: span.endMs } : null;
    if (dragScope === "line" && !line) return;
    canvas.setPointerCapture(event.pointerId);
    if (dragScope === "line" && media) media.pause();
    if (line && dragScope === "line") chooseLine(line.key);
    dragRef.current = { id: event.pointerId, scope: dragScope, target: dragTarget, x: event.clientX, y: event.clientY, origin: lookRef.current, clips: clipsRef.current, line };
  }

  function moveLyrics(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || drag.id !== event.pointerId || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const next = moveLyricPositions(drag.origin, drag.clips, drag.scope, drag.target, drag.line, (event.clientX - drag.x) / rect.width, (event.clientY - drag.y) / rect.height);
    lookRef.current = next.look;
    clipsRef.current = next.clips;
    setLook(next.look);
    setClips(next.clips);
    kickPaint.current();
  }

  function alignPositions() {
    const key = selectedKey;
    setPositionUndo({ look: lookRef.current, clips: clipsRef.current, target: dragTarget });
    const next = alignLyricPositions(lookRef.current, clipsRef.current, dragTarget, key || undefined);
    lookRef.current = next.look;
    clipsRef.current = next.clips;
    setLook(next.look);
    setClips(next.clips);
    kickPaint.current();
  }

  function toggle() {
    const media = activeMedia(videoRef.current, audioRef.current);
    if (!media) return;
    if (media.paused) void media.play();
    else media.pause();
  }

  return (
    <main className="studio">
      <header className="topbar">
        <IconButton label="返回" disabled={leaving} onClick={() => void leave(onBack)}>
          <BackIcon />
        </IconButton>
        <div className="title-block">
          <h1>歌詞影片</h1>
          <p className="status">
            {session.title || "預覽"}
            {hasLyrics ? "" : " · 尚未有歌詞"}
          </p>
        </div>
        <span role="status">{({ saved: "已保存", pending: "待保存", saving: "保存中…", error: "保存失敗，修改仍保留喺畫面" })[saveStatus]}
          {saveStatus === "error" ? <button disabled={leaving} onClick={() => void saveLatest()}>重試保存</button> : null}
        </span>
      </header>
      {leaveError ? <p role="alert">{leaveError}</p> : null}
      <div className="studio-body" inert={leaving}>
        <section className="stage-col">
          <div className="row">
            <label>拖動範圍<select value={dragScope} onChange={(event) => setDragScope(event.target.value === "line" ? "line" : "song")}><option value="song">成首排版</option><option value="line">只改這句</option></select></label>
            <label>拖動對象<select value={dragTarget} onChange={(event) => setDragTarget(event.target.value as PositionTarget)}><option value="orig" disabled={look.showOriginal === false}>原文</option><option value="trans">譯文</option><option value="both">原文及譯文</option></select></label>
            <button disabled={!hasLyrics} onClick={alignPositions}>將選定句位置套用到成首</button>
            <button disabled={!positionUndo} onClick={() => {
              if (!positionUndo) return;
              const restored = restoreLyricPositions(lookRef.current, clipsRef.current, positionUndo, positionUndo.target);
              lookRef.current = restored.look; clipsRef.current = restored.clips;
              setLook(restored.look); setClips(restored.clips); setPositionUndo(null); kickPaint.current();
            }}>撤回統一位置</button>
            <button aria-pressed={look.showOriginal === false} onClick={() => { const next = { ...lookRef.current, showOriginal: lookRef.current.showOriginal === false }; lookRef.current = next; setLook(next); }}>{look.showOriginal === false ? "顯示原文" : "隱藏原文"}</button>
          </div>
          <p className="meta">先用成首排版定位，再切到只改這句處理例外。拖空白亦只影響已選對象及範圍。統一位置只取代位置偏移，保留字體及效果；可撤回。未選句時以成首位置統一。</p>
          <div className="stage-fit">
            <div className="stage">
              {session.mode === "video" ? (
                <video
                  ref={videoRef}
                  src={src}
                  preload="auto"
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || duration)}
                />
              ) : (
                <audio
                  ref={audioRef}
                  src={src}
                  preload="auto"
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || duration)}
                />
              )}
              <canvas
                ref={canvasRef}
                onPointerDown={beginDrag}
                onPointerMove={moveLyrics}
                onPointerUp={(event) => {
                  if (dragRef.current?.id !== event.pointerId) return;
                  dragRef.current = null;
                  kickPaint.current();
                }}
                onPointerCancel={(event) => {
                  if (dragRef.current?.id !== event.pointerId) return;
                  dragRef.current = null;
                  kickPaint.current();
                }}
              />
            </div>
          </div>
          <div className="stage-foot">
            <div className="row">
              <IconButton label={playing ? "暫停" : "播放"} onClick={toggle}>
                {playing ? <PauseIcon /> : <PlayIcon />}
              </IconButton>
              <SeekBar mode={session.mode} videoRef={videoRef} audioRef={audioRef} fallbackSec={duration} onTime={setPos} />
            </div>
            <TimeReadout nodeRef={readRef} />
            <div className="stage-actions">
              {allowPick && onPick ? (
                <button type="button" disabled={leaving} onClick={() => void leave(onPick)}>
                  選擇歌詞
                </button>
              ) : null}
              <label className="lock">
                <input type="checkbox" checked={debug} onChange={(event) => setDebug(event.target.checked)} />
                時間讀數
              </label>
              <div className="exports">
                <button type="button" disabled={!hasLyrics || exporting || savingAss} onClick={() => void exportAss()}>
                  {savingAss ? "正在寫 ASS" : "輸出 ASS"}
                </button>
                <button
                  type="button"
                  className="export"
                  disabled={!hasLyrics || exporting || savingAss || !session.mediaPath}
                  onClick={() => void exportVideo()}
                >
                  {exporting ? "正在匯出" : "匯出 MP4"}
                </button>
              </div>
            </div>
            {exportText ? <p className="meta">{exportText}</p> : null}
          </div>
        </section>
        <aside className="dock">
          <div className="tabs">
            <button type="button" className={pane === "text" ? "on" : undefined} onClick={() => setPane("text")}>
              文字
            </button>
            <button type="button" className={pane === "shape" ? "on" : undefined} onClick={() => setPane("shape")}>
              外形
            </button>
          </div>
          <p className="meta">{pane === "text" ? "歌詞、譯文和時間軸。" : "字體、位置和效果。每項可以收起。"}</p>
          <div className={pane === "text" ? "pane" : "pane off"}>
            <TimingPanel
              baseLines={linesRef.current}
              timing={timing}
              lyricMs={lyricClockMs(pos * 1000, timing.offsetMs, timing.rate)}
              selectedKey={selectedKey}
              onSelect={chooseLine}
              onReplace={(recipe) =>
                setTiming((current) => {
                  const next = recipe(current);
                  timingRef.current = next;
                  return next;
                })
              }
              onReplay={replay}
              hotkeys={pane === "text"}
            />
          </div>
          <div className={pane === "shape" ? "pane" : "pane off"}>
            <ShapePanel
              baseLines={linesRef.current}
              timing={timing}
              clips={clips}
              look={look}
              selectedKey={selectedKey}
              pick={pick}
              onSelect={chooseLine}
              onClips={(next) => {
                clipsRef.current = next;
                setClips(next);
              }}
              onLook={(next) => {
                const clamped = clampLook(next);
                lookRef.current = clamped;
                setLook(clamped);
              }}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}

const TimeReadout = memo(function TimeReadout({ nodeRef }: { nodeRef: RefObject<HTMLParagraphElement | null> }) {
  return (
    <p className="readout" ref={nodeRef} hidden>
      <span />
      <span />
      <span />
      <span />
    </p>
  );
});

function readClock(ms: number): string {
  if (!Number.isFinite(ms)) return "0:00.000";
  const sign = ms < 0 ? "−" : "";
  const abs = Math.abs(Math.round(ms));
  const minutes = Math.floor(abs / 60000);
  const seconds = Math.floor(abs / 1000) % 60;
  const millis = abs % 1000;
  return `${sign}${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}
