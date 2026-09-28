import { useEffect, useRef, useState, type PointerEvent } from "react";
import { drawPreview, sessionLines } from "./drawPreview";
import { TimingPanel } from "./TimingPanel";
import { lyricClockMs, mediaMsForLyric } from "../../core/preview";
import { timeOfMs, type LyricLine } from "../../core/lyrics";
import { clampLook, moveLook, type LyricLook } from "../../core/lyricLook";
import { timingForProject, timingFromProject } from "../../core/projectTiming";
import type { TrackTiming } from "../../core/timing";
import { mediaSrc, type PreviewSession } from "../../shared/preview";
import { BackIcon, IconButton, PauseIcon, PlayIcon } from "./icons";
import { LyricLookPanel } from "./LyricLookPanel";
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
  const linesRef = useRef(sessionLines(session.lines));
  const debugRef = useRef(true);
  const [timing, setTiming] = useState<TrackTiming>(() => timingFromProject(session.timing));
  const timingRef = useRef(timing);
  const [look, setLook] = useState<LyricLook>(() => clampLook(session.look));
  const lookRef = useRef(look);
  const dragRef = useRef<{ id: number; x: number; y: number; origin: LyricLook } | null>(null);
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
  }, [session, debug, timing, showTrans, look]);

  useEffect(() => {
    const next = clampLook(session.look);
    lookRef.current = next;
    setLook(next);
  }, [session]);

  useEffect(() => window.lyric.onExportProgress(setExportText), []);

  useEffect(() => {
    if (!session.projectPath) return;
    const handle = window.setTimeout(() => {
      void window.lyric.saveTiming(session.projectPath, timingForProject(timing), look);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [timing, look, session.projectPath]);

  useEffect(() => {
    void ensureChiron();
  }, []);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const canvas = canvasRef.current;
      const media = activeMedia(videoRef.current, audioRef.current);
      const posMs = media ? media.currentTime * 1000 : 0;
      if (canvas) {
        drawPreview(canvas, linesRef.current, posMs, session.mode, debugRef.current, timingRef.current, lookRef.current);
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

  function moveLyrics(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || drag.id !== event.pointerId || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const next = moveLook(
      drag.origin,
      (event.clientX - drag.x) / rect.width,
      (event.clientY - drag.y) / rect.height,
    );
    lookRef.current = next;
    setLook(next);
  }

  function toggle() {
    const media = activeMedia(videoRef.current, audioRef.current);
    if (!media) return;
    if (media.paused) void media.play();
    else media.pause();
  }

  return (
    <main>
      <header className="topbar">
        <IconButton label="返回" onClick={onBack}>
          <BackIcon />
        </IconButton>
        <h1>歌詞影片</h1>
      </header>
      <p className="status">
        {session.title || "預覽"}
        {hasLyrics ? "" : " · 尚未有歌詞"}
      </p>
      <div className="card">
        {allowPick && onPick ? (
          <button type="button" onClick={onPick}>
            選擇歌詞
          </button>
        ) : null}
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
            onPointerDown={(event) => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              canvas.setPointerCapture(event.pointerId);
              dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: lookRef.current };
            }}
            onPointerMove={moveLyrics}
            onPointerUp={(event) => {
              if (dragRef.current?.id === event.pointerId) dragRef.current = null;
            }}
          />
        </div>
        <div className="row">
          <IconButton label={playing ? "暫停" : "播放"} onClick={toggle}>
            {playing ? <PauseIcon /> : <PlayIcon />}
          </IconButton>
          <SeekBar
            videoRef={videoRef}
            audioRef={audioRef}
            fallbackSec={duration}
            onTime={setPos}
          />
        </div>
        <LyricLookPanel
          look={look}
          onChange={(next) => {
            const clamped = clampLook(next);
            lookRef.current = clamped;
            setLook(clamped);
          }}
        />
        <TimingPanel
          baseLines={linesRef.current}
          timing={timing}
          lyricMs={lyricClockMs(pos * 1000, timing.offsetMs, timing.rate)}
          onReplace={(recipe) =>
            setTiming((current) => {
              const next = recipe(current);
              timingRef.current = next;
              return next;
            })
          }
          onReplay={replay}
        />
        <label className="lock">
          <input
            type="checkbox"
            checked={debug}
            onChange={(event) => setDebug(event.target.checked)}
          />
          時間讀數
        </label>
        <button type="button" disabled={!hasLyrics || exporting || !session.mediaPath} onClick={() => void exportVideo()}>
          {exporting ? "正在匯出" : "匯出 MP4"}
        </button>
        {exportText ? <p className="meta">{exportText}</p> : null}
      </div>
    </main>
  );
}
