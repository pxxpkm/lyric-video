import { useEffect, useRef, useState } from "react";
import { drawPreview, sessionLines } from "./drawPreview";
import { TimingPanel } from "./TimingPanel";
import { lyricClockMs, mediaMsForLyric } from "../../core/preview";
import { timeOfMs, type LyricLine } from "../../core/lyrics";
import { timingForProject, timingFromProject } from "../../core/projectTiming";
import type { TrackTiming } from "../../core/timing";
import { mediaSrc, type PreviewSession } from "../../shared/preview";
import { BackIcon, IconButton, PauseIcon, PlayIcon } from "./icons";

export function Preview({ session, onBack }: { session: PreviewSession; onBack: () => void }) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const linesRef = useRef(sessionLines(session.lines));
  const debugRef = useRef(true);
  const [timing, setTiming] = useState<TrackTiming>(() => timingFromProject(session.timing));
  const timingRef = useRef(timing);
  const [debug, setDebug] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [duration, setDuration] = useState(session.durationMs / 1000);
  const src = mediaSrc(session.mediaPath);
  const hasLyrics = session.lines.length > 0;

  useEffect(() => {
    linesRef.current = sessionLines(session.lines);
    debugRef.current = debug;
    timingRef.current = timing;
  }, [session, debug, timing]);

  useEffect(() => {
    if (!session.projectPath) return;
    const handle = window.setTimeout(() => {
      void window.lyric.saveTiming(session.projectPath, timingForProject(timing));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [timing, session.projectPath]);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const canvas = canvasRef.current;
      const media = mediaRef.current;
      const posMs = media ? media.currentTime * 1000 : 0;
      if (canvas) {
        drawPreview(canvas, linesRef.current, posMs, session.mode, debugRef.current, timingRef.current);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const timer = window.setInterval(() => {
      setPos(mediaRef.current?.currentTime ?? 0);
    }, 100);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [session.mode]);

  function replay(line: LyricLine) {
    const media = mediaRef.current;
    if (!media) return;
    const lyric = Math.max(0, timeOfMs(line, timing.lines) - 2_000);
    media.currentTime = mediaMsForLyric(lyric, timing.offsetMs, timing.rate) / 1000;
    void media.play();
  }

  function toggle() {
    const media = mediaRef.current;
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
        <div className="stage">
          {session.mode === "video" ? (
            <video
              ref={(node) => {
                mediaRef.current = node;
              }}
              src={src}
              preload="auto"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || duration)}
            />
          ) : (
            <audio
              ref={(node) => {
                mediaRef.current = node;
              }}
              src={src}
              preload="auto"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || duration)}
            />
          )}
          <canvas ref={canvasRef} />
        </div>
        <div className="row">
          <IconButton label={playing ? "暫停" : "播放"} onClick={toggle}>
            {playing ? <PauseIcon /> : <PlayIcon />}
          </IconButton>
          <input
            className="seek"
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={Math.min(pos, duration || 0)}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (mediaRef.current) mediaRef.current.currentTime = next;
              setPos(next);
            }}
          />
        </div>
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
        <button type="button" disabled title="這一步還不能匯出">
          匯出 MP4
        </button>
      </div>
    </main>
  );
}
