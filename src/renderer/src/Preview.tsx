import { memo, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { drawPreview, hitsCurrentLyric, sessionLines } from "./drawPreview";
import { ShapePanel } from "./ShapePanel";
import { TimingPanel } from "./TimingPanel";
import { lyricClockMs, mediaMsForLyric, previewFrame } from "../../core/preview";
import { mediaSpans, placeLineClip, placeTransClip, type MotionClip } from "../../core/motion";
import { timeOfMs, type LyricLine } from "../../core/lyrics";
import { clampLook, moveLook, type LyricLook } from "../../core/lyricLook";
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
  onPick?: () => void;
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
  const allOnRef = useRef(false);
  const dragRef = useRef<
    | { id: number; kind: "song" | "all-orig" | "all-trans"; x: number; y: number; origin: LyricLook }
    | { id: number; kind: "orig"; key: string; text: string; startMs: number; endMs: number }
    | { id: number; kind: "trans"; key: string; text: string; startMs: number; endMs: number }
    | null
  >(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [pick, setPick] = useState(0);
  const [pane, setPane] = useState<"text" | "shape">("text");
  const [debug, setDebug] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportText, setExportText] = useState("");
  const [pos, setPos] = useState(0);
  const [duration, setDuration] = useState(session.durationMs / 1000);
  const src = mediaSrc(session.mediaPath);
  const hasLyrics = session.lines.length > 0;
  const allowPick = !session.projectPath.replaceAll("\\", "/").endsWith("/test-clip/project.json");

  useEffect(() => {
    linesRef.current = sessionLines(session.lines).map((line) =>
      showTrans ? line : { ...line, translatedText: null },
    );
    debugRef.current = debug;
    timingRef.current = timing;
    lookRef.current = look;
    clipsRef.current = clips;
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

  useEffect(() => {
    if (!session.projectPath) return;
    const handle = window.setTimeout(() => {
      void window.lyric.saveTiming(session.projectPath, timingForProject(timing), look, clips);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [timing, look, clips, session.projectPath]);

  useEffect(() => {
    void ensureChiron();
  }, []);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const canvas = canvasRef.current;
      const media = activeMedia(videoRef.current, audioRef.current);
      const posMs = media ? media.currentTime * 1000 : 0;
      const painted = canvas
        ? drawPreview(
            canvas,
            linesRef.current,
            posMs,
            session.mode,
            timingRef.current,
            lookRef.current,
            clipsRef.current,
          )
        : null;
      const read = readRef.current;
      if (read) {
        const show = debugRef.current;
        read.hidden = !show;
        if (show && painted) {
          const timingNow = timingRef.current;
          const lyricMs = lyricClockMs(posMs, timingNow.offsetMs, timingNow.rate);
          const lineMs = mediaMsForLyric(painted.atMs, timingNow.offsetMs, timingNow.rate);
          const cells = read.querySelectorAll("span");
          const next = [
            `播放 ${readClock(posMs)}`,
            `歌詞 ${readClock(lyricMs)}`,
            `呢句 ${painted.text ? readClock(lineMs) : "—"}`,
            `第 ${painted.wordIndex >= 0 ? painted.wordIndex + 1 : "—"} 字`,
          ];
          cells.forEach((cell, index) => {
            if (cell.textContent !== next[index]) cell.textContent = next[index];
          });
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [session.mode]);

  function replay(line: LyricLine) {
    const media = activeMedia(videoRef.current, audioRef.current);
    if (!media) return;
    const lyric = Math.max(0, timeOfMs(line, timing.lines) - 2_000);
    media.currentTime = mediaMsForLyric(lyric, timing.offsetMs, timing.rate) / 1000;
    void media.play();
  }

  async function exportVideo() {
    setExporting(true);
    setExportText("正在寫字幕");
    try {
      const result = await window.lyric.exportVideo({
        projectPath: session.projectPath,
        mediaPath: session.mediaPath,
        mode: session.mode,
        durationMs: session.durationMs,
        lines: showTrans ? session.lines : session.lines.map((line) => ({ ...line, trans: "" })),
        timing: timingForProject(timing),
        look,
        motion: clips,
        title: session.title,
      });
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

  function chooseLine(key: string) {
    setSelectedKey(key);
    setPick((value) => value + 1);
  }

  function beginDrag(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    const media = activeMedia(videoRef.current, audioRef.current);
    const mediaMs = media ? media.currentTime * 1000 : 0;
    const hit =
      rect.width >= 2 && rect.height >= 2
        ? hitsCurrentLyric(canvas, linesRef.current, mediaMs, timingRef.current, lookRef.current, clipsRef.current, {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          })
        : null;
    if (hit && allOnRef.current) {
      dragRef.current = {
        id: event.pointerId,
        kind: hit === "orig" ? "all-orig" : "all-trans",
        x: event.clientX,
        y: event.clientY,
        origin: lookRef.current,
      };
      return;
    }
    if (hit) {
      const lyricMs = lyricClockMs(mediaMs, timingRef.current.offsetMs, timingRef.current.rate);
      const frame = previewFrame(linesRef.current, lyricMs, timingRef.current);
      const span = frame.key ? mediaSpans(linesRef.current, timingRef.current).get(frame.key) : undefined;
      if (frame.key && span) {
        dragRef.current = { id: event.pointerId, kind: hit, key: frame.key, text: frame.text, startMs: span.startMs, endMs: span.endMs };
        chooseLine(frame.key);
        return;
      }
    }
    dragRef.current = { id: event.pointerId, kind: "song", x: event.clientX, y: event.clientY, origin: lookRef.current };
  }

  function moveLyrics(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || drag.id !== event.pointerId || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    if (drag.kind === "orig" || drag.kind === "trans") {
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const next =
        drag.kind === "orig"
          ? placeLineClip(clipsRef.current, drag.key, drag.text, drag.startMs, drag.endMs, x, y, lookRef.current)
          : placeTransClip(clipsRef.current, drag.key, drag.text, drag.startMs, drag.endMs, x, y, lookRef.current);
      clipsRef.current = next;
      setClips(next);
      return;
    }
    const dx = (event.clientX - drag.x) / rect.width;
    const dy = (event.clientY - drag.y) / rect.height;
    const nextLook =
      drag.kind === "all-orig"
        ? clampLook({ ...drag.origin, x: drag.origin.x + dx, y: drag.origin.y + dy })
        : drag.kind === "all-trans"
          ? clampLook({ ...drag.origin, transX: drag.origin.transX + dx, transY: drag.origin.transY + dy })
          : moveLook(drag.origin, dx, dy);
    lookRef.current = nextLook;
    setLook(nextLook);
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
        <IconButton label="返回" onClick={onBack}>
          <BackIcon />
        </IconButton>
        <div className="title-block">
          <h1>歌詞影片</h1>
          <p className="status">
            {session.title || "預覽"}
            {hasLyrics ? "" : " · 尚未有歌詞"}
          </p>
        </div>
        <span />
      </header>
      <div className="studio-body">
        <section className="stage-col">
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
                  if (dragRef.current?.id === event.pointerId) dragRef.current = null;
                }}
              />
            </div>
          </div>
          <div className="stage-foot">
            <div className="row">
              <IconButton label={playing ? "暫停" : "播放"} onClick={toggle}>
                {playing ? <PauseIcon /> : <PlayIcon />}
              </IconButton>
              <SeekBar videoRef={videoRef} audioRef={audioRef} fallbackSec={duration} onTime={setPos} />
            </div>
            <TimeReadout nodeRef={readRef} />
            <div className="stage-actions">
              {allowPick && onPick ? (
                <button type="button" onClick={onPick}>
                  選擇歌詞
                </button>
              ) : null}
              <label className="lock">
                <input type="checkbox" checked={debug} onChange={(event) => setDebug(event.target.checked)} />
                時間讀數
              </label>
              <button
                type="button"
                className="export"
                disabled={!hasLyrics || exporting || !session.mediaPath}
                onClick={() => void exportVideo()}
              >
                {exporting ? "正在匯出" : "匯出 MP4"}
              </button>
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
              onAllChange={(on) => {
                allOnRef.current = on;
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
