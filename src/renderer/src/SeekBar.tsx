import { useEffect, useRef, type RefObject } from "react";

export function SeekBar({
  videoRef,
  audioRef,
  fallbackSec,
  onTime,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  audioRef: RefObject<HTMLAudioElement | null>;
  fallbackSec: number;
  onTime: (seconds: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const drag = useRef(false);
  const onTimeRef = useRef(onTime);
  onTimeRef.current = onTime;

  useEffect(() => {
    let frame = 0;
    let lastSent = 0;
    const tick = () => {
      const node = videoRef.current ?? audioRef.current;
      const dur = readDuration(node, fallbackSec);
      const time = node?.currentTime ?? 0;
      if (!drag.current && fillRef.current) {
        fillRef.current.style.width = dur > 0 ? `${Math.min(100, (time / dur) * 100)}%` : "0%";
      }
      if (labelRef.current) labelRef.current.textContent = `${clock(time)} / ${clock(dur)}`;
      const now = performance.now();
      if (!drag.current && now - lastSent > 200) {
        lastSent = now;
        onTimeRef.current(time);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [audioRef, fallbackSec, videoRef]);

  function seek(clientX: number) {
    const bar = barRef.current;
    const node = videoRef.current ?? audioRef.current;
    if (!bar || !node) return;
    const rect = bar.getBoundingClientRect();
    const dur = readDuration(node, fallbackSec);
    if (dur <= 0 || rect.width < 2) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const next = ratio * dur;
    node.currentTime = next;
    if (fillRef.current) fillRef.current.style.width = `${ratio * 100}%`;
    if (labelRef.current) labelRef.current.textContent = `${clock(next)} / ${clock(dur)}`;
    onTime(next);
  }

  return (
    <div
      className="seekbar"
      ref={barRef}
      onPointerDown={(event) => {
        drag.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        seek(event.clientX);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        seek(event.clientX);
      }}
      onPointerUp={() => {
        drag.current = false;
      }}
      onPointerCancel={() => {
        drag.current = false;
      }}
    >
      <div className="seekbar-fill" ref={fillRef} />
      <span className="seekbar-time" ref={labelRef}>
        0:00 / 0:00
      </span>
    </div>
  );
}

function readDuration(node: HTMLMediaElement | null, fallbackSec: number): number {
  if (node && Number.isFinite(node.duration) && node.duration > 0) return node.duration;
  if (node && node.seekable.length > 0) {
    const end = node.seekable.end(node.seekable.length - 1);
    if (Number.isFinite(end) && end > 0) return end;
  }
  return fallbackSec > 0 ? fallbackSec : 0;
}

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
