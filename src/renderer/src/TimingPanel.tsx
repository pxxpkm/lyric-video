import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyEdits,
  formatShownLrc,
  lineKey,
  parseClipboardLyrics,
  parseTimingTags,
  replaceShown,
  type LyricLine,
} from "../../core/lyrics";
import {
  MAX_MS,
  MIN_MS,
  RATE_MAX,
  RATE_MIN,
  RATE_STEP,
  formatHold,
  formatOffset,
  repeatAdjustment,
  withAdded,
  withLineHold,
  withLineShift,
  withLineText,
  withLineTrans,
  withoutLine,
  type TrackTiming,
} from "../../core/timing";
import { IconButton, ReplayIcon, UndoIcon, ZeroIcon } from "./icons";
import { LineList } from "./LineList";

export function TimingPanel({
  baseLines,
  timing,
  lyricMs,
  selectedKey,
  onSelect,
  onReplace,
  onReplay,
}: {
  baseLines: LyricLine[];
  timing: TrackTiming;
  lyricMs: number;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onReplace: (recipe: (current: TrackTiming) => TrackTiming) => void;
  onReplay: (line: LyricLine) => void;
}) {
  const shown = useMemo(() => applyEdits(baseLines, timing), [baseLines, timing]);
  const [lrc, setLrc] = useState("");
  const [offsetPast, setOffsetPast] = useState<number[]>([]);
  const [ratePast, setRatePast] = useState<number[]>([]);
  const timingRef = useRef(timing);
  const selectedKeyRef = useRef(selectedKey);
  const gesture = useRef<"offset" | "rate" | null>(null);
  timingRef.current = timing;
  selectedKeyRef.current = selectedKey;
  const selected = shown.find((line) => lineKey(line) === selectedKey) ?? null;
  const selectedShift = selected ? (timing.lines?.[lineKey(selected)] ?? 0) : 0;
  const selectedHold = selected ? (timing.holds?.[lineKey(selected)] ?? 0) : 0;

  function apply(next: TrackTiming) {
    onReplace(() => next);
  }

  function stepOffset(delta: number) {
    let from: number | null = null;
    onReplace((current) => {
      const offsetMs = clamp(current.offsetMs + delta, MIN_MS, MAX_MS);
      if (offsetMs === current.offsetMs) return current;
      if (gesture.current !== "offset") from = current.offsetMs;
      timingRef.current = { ...current, offsetMs };
      return timingRef.current;
    });
    if (from !== null) {
      gesture.current = "offset";
      const saved = from;
      setOffsetPast((stack) => [...stack, saved].slice(-40));
    }
  }

  function stepRate(delta: number) {
    let from: number | null = null;
    onReplace((current) => {
      const rate = clampRate(current.rate + delta);
      if (rate === current.rate) return current;
      if (gesture.current !== "rate") from = current.rate;
      timingRef.current = { ...current, rate };
      return timingRef.current;
    });
    if (from !== null) {
      gesture.current = "rate";
      const saved = from;
      setRatePast((stack) => [...stack, saved].slice(-40));
    }
  }

  function stepLine(delta: number) {
    const key = selectedKeyRef.current;
    if (!key) return;
    onReplace((current) => withLineShift(current, key, (current.lines?.[key] ?? 0) + delta));
  }

  function stepHold(delta: number) {
    const key = selectedKeyRef.current;
    if (!key) return;
    onReplace((current) => withLineHold(current, key, (current.holds?.[key] ?? 0) + delta));
  }

  function endGesture() {
    gesture.current = null;
  }

  function pushOffset(next: number) {
    if (next === timing.offsetMs) return;
    setOffsetPast((stack) => [...stack, timing.offsetMs].slice(-40));
    onReplace((current) => ({ ...current, offsetMs: next }));
  }

  function pushRate(next: number) {
    if (next === timing.rate) return;
    setRatePast((stack) => [...stack, timing.rate].slice(-40));
    onReplace((current) => ({ ...current, rate: next }));
  }

  return (
    <div className="timing">
      <div className="timing-global">
      <div className="row">
        <span className="meta">延遲</span>
        <RepeatButton label="−50 ms" title="歌詞慢了" kind="ms" sign={-1} onStep={stepOffset} onRelease={endGesture} />
        <RepeatButton label="+50 ms" title="歌詞快了" kind="ms" sign={1} onStep={stepOffset} onRelease={endGesture} />
        <span className="meta">{formatOffset(timing.offsetMs)}</span>
        <IconButton label="延遲歸零" disabled={timing.offsetMs === 0} onClick={() => pushOffset(0)}>
          <ZeroIcon />
        </IconButton>
        <IconButton
          label="延遲上一步"
          disabled={offsetPast.length === 0}
          onClick={() => {
            const previous = offsetPast[offsetPast.length - 1];
            setOffsetPast((stack) => stack.slice(0, -1));
            apply({ ...timing, offsetMs: previous });
          }}
        >
          <UndoIcon />
        </IconButton>
      </div>
      <div className="row">
        <span className="meta">速度</span>
        <RepeatButton label="−" title="慢一點，按住會連續減" kind="rate" sign={-1} onStep={stepRate} onRelease={endGesture} />
        <RepeatButton label="＋" title="快一點，按住會連續加" kind="rate" sign={1} onStep={stepRate} onRelease={endGesture} />
        <span className="meta">{timing.rate.toFixed(3)}x</span>
        <IconButton label="速度回到 1" disabled={timing.rate === 1} onClick={() => pushRate(1)}>
          <ZeroIcon />
        </IconButton>
        <IconButton
          label="速度上一步"
          disabled={ratePast.length === 0}
          onClick={() => {
            const previous = ratePast[ratePast.length - 1];
            setRatePast((stack) => stack.slice(0, -1));
            apply({ ...timing, rate: previous });
          }}
        >
          <UndoIcon />
        </IconButton>
      </div>
      </div>
      <LineList lines={shown} timing={timing} selectedKey={selectedKey} onSelect={onSelect} />
      <div className="timing-edit">
      <div className="row">
        <span className="meta">呢句</span>
        <RepeatButton label="−" title="歌詞慢了" kind="ms" sign={-1} disabled={!selected} onStep={stepLine} />
        <span className="meta read">{formatOffset(selectedShift)}</span>
        <RepeatButton label="＋" title="歌詞快了" kind="ms" sign={1} disabled={!selected} onStep={stepLine} />
        <IconButton label="重播" disabled={!selected} onClick={() => selected && onReplay(selected)}>
          <ReplayIcon />
        </IconButton>
        <button
          type="button"
          className="tiny"
          disabled={!selected}
          onClick={() => selected && apply(withoutLine(timing, lineKey(selected)))}
        >
          重設呢句
        </button>
      </div>
      <div className="row">
        <span className="meta">停留</span>
        <RepeatButton label="−" title="短 0.25 秒，按住會連續減" kind="stay" sign={-1} disabled={!selected} onStep={stepHold} />
        <span className="meta read">{formatHold(selectedHold)}</span>
        <RepeatButton label="＋" title="長 0.25 秒，按住會連續加" kind="stay" sign={1} disabled={!selected} onStep={stepHold} />
      </div>
      <div className="pair">
        <label>
          歌詞
          <input
            type="text"
            disabled={!selected}
            value={selected?.text ?? ""}
            onChange={(event) => {
              if (!selected) return;
              const key = lineKey(selected);
              const value = event.target.value;
              onReplace((current) => withLineText(current, key, value));
            }}
          />
        </label>
        <label>
          譯文
          <input
            type="text"
            disabled={!selected}
            value={selected?.translatedText ?? ""}
            onChange={(event) => {
              if (!selected) return;
              const key = lineKey(selected);
              const value = event.target.value;
              onReplace((current) => withLineTrans(current, key, value));
            }}
          />
        </label>
      </div>
      <button
        type="button"
        className="tiny"
        onClick={() =>
          apply(
            withAdded(timing, {
              atMs: Math.max(0, Math.round(lyricMs)),
              text: "新句",
              id: crypto.randomUUID().replaceAll("-", "").slice(0, 8),
            }),
          )
        }
      >
        在這裡插入
      </button>
      <label>
        LRC
        <textarea value={lrc} rows={3} onChange={(event) => setLrc(event.target.value)} />
      </label>
      <div className="row">
        <button type="button" className="tiny" onClick={() => setLrc(formatShownLrc(shown, timing))}>
          寫入欄
        </button>
        <button
          type="button"
          className="tiny"
          onClick={() => {
            const tags = parseTimingTags(lrc);
            const clips = parseClipboardLyrics(lrc, 0);
            const next = replaceShown(timing, baseLines, clips, tags.offsetMs, tags.rate);
            if (next.offsetMs !== timing.offsetMs) setOffsetPast((stack) => [...stack, timing.offsetMs].slice(-40));
            if (next.rate !== timing.rate) setRatePast((stack) => [...stack, timing.rate].slice(-40));
            apply(next);
          }}
        >
          從欄套用
        </button>
      </div>
      </div>
    </div>
  );
}

function RepeatButton({
  label,
  title,
  disabled,
  kind,
  sign,
  onStep,
  onRelease,
}: {
  label: string;
  title?: string;
  disabled?: boolean;
  kind: "ms" | "stay" | "rate";
  sign: 1 | -1;
  onStep: (delta: number) => void;
  onRelease?: () => void;
}) {
  const onStepRef = useRef(onStep);
  const onReleaseRef = useRef(onRelease);
  const timer = useRef<number | null>(null);
  const started = useRef(0);
  onStepRef.current = onStep;
  onReleaseRef.current = onRelease;

  function stop() {
    if (timer.current != null) window.clearInterval(timer.current);
    timer.current = null;
  }

  useEffect(() => () => stop(), []);

  return (
    <button
      type="button"
      className="tiny"
      title={title ?? "按住會連續調整"}
      disabled={disabled}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        stop();
        started.current = performance.now();
        const first = repeatAdjustment(kind, 0, true, sign);
        if (first !== 0) onStepRef.current(first);
        timer.current = window.setInterval(() => {
          const step = repeatAdjustment(kind, performance.now() - started.current, false, sign);
          if (step !== 0) onStepRef.current(step);
        }, 60);
      }}
      onPointerUp={(event) => {
        stop();
        onReleaseRef.current?.();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        stop();
        onReleaseRef.current?.();
      }}
      onClick={(event) => event.preventDefault()}
    >
      {label}
    </button>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampRate(value: number): number {
  return clamp(Math.round(value * 1000) / 1000, RATE_MIN, RATE_MAX);
}
