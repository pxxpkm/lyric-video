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
import { undoTiming } from "../../core/preview";
import {
  MAX_MS,
  MIN_MS,
  RATE_MAX,
  RATE_MIN,
  RATE_STEP,
  formatHold,
  formatOffset,
  hideLine,
  repeatAdjustment,
  sameTiming,
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
  hotkeys,
}: {
  baseLines: LyricLine[];
  timing: TrackTiming;
  lyricMs: number;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onReplace: (recipe: (current: TrackTiming) => TrackTiming) => void;
  onReplay: (line: LyricLine) => void;
  hotkeys: boolean;
}) {
  const shown = useMemo(() => applyEdits(baseLines, timing), [baseLines, timing]);
  const [lrc, setLrc] = useState("");
  const [offsetPast, setOffsetPast] = useState<number[]>([]);
  const [ratePast, setRatePast] = useState<number[]>([]);
  const [past, setPast] = useState<TrackTiming[]>([]);
  const timingRef = useRef(timing);
  const pastRef = useRef(past);
  const selectedKeyRef = useRef(selectedKey);
  const gesture = useRef<"offset" | "rate" | "line" | "hold" | null>(null);
  const composing = useRef(false);
  const composeBase = useRef<TrackTiming | null>(null);
  const skipRecord = useRef(false);
  timingRef.current = timing;
  pastRef.current = past;
  selectedKeyRef.current = selectedKey;
  const selected = shown.find((line) => lineKey(line) === selectedKey) ?? null;
  const selectedShift = selected ? (timing.lines?.[lineKey(selected)] ?? 0) : 0;
  const selectedHold = selected ? (timing.holds?.[lineKey(selected)] ?? 0) : 0;

  function pushPast(snapshot: TrackTiming) {
    const stack = pastRef.current;
    const top = stack[stack.length - 1];
    if (top && sameTiming(top, snapshot)) return;
    const nextStack = [...stack, snapshot].slice(-40);
    pastRef.current = nextStack;
    setPast(nextStack);
  }

  // 歷史喺 setState 外面推。Strict Mode 會用同一個狀態呼叫更新兩次。
  function write(recipe: (current: TrackTiming) => TrackTiming, record: "yes" | "no" | "offset" | "rate" | "line" | "hold"): "skip" | "first" | "more" {
    const current = timingRef.current;
    const next = recipe(current);
    if (sameTiming(current, next)) return "skip";
    const hold = record === "offset" || record === "rate" || record === "line" || record === "hold";
    const first = !hold || gesture.current !== record;
    if (record === "yes" || (hold && first)) pushPast(current);
    if (hold) gesture.current = record;
    timingRef.current = next;
    onReplace(() => next);
    return first ? "first" : "more";
  }

  function undo() {
    const undone = undoTiming(pastRef.current, timingRef.current);
    if (undone.past === pastRef.current) return;
    pastRef.current = undone.past;
    setPast(undone.past);
    gesture.current = null;
    timingRef.current = undone.current;
    onReplace(() => undone.current);
  }

  function removeSelected() {
    const key = selectedKeyRef.current;
    if (!key) return;
    write((current) => hideLine(current, key), "yes");
  }

  const undoRef = useRef(undo);
  const removeRef = useRef(removeSelected);
  undoRef.current = undo;
  removeRef.current = removeSelected;

  useEffect(() => {
    if (!hotkeys) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      const target = event.target;
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "z") {
        if (target instanceof HTMLTextAreaElement) return;
        event.preventDefault();
        undoRef.current();
        return;
      }
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (!selectedKeyRef.current) return;
      event.preventDefault();
      removeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkeys]);

  function stepOffset(delta: number) {
    const before = timingRef.current.offsetMs;
    const outcome = write((current) => {
      const offsetMs = clamp(current.offsetMs + delta, MIN_MS, MAX_MS);
      if (offsetMs === current.offsetMs) return current;
      return { ...current, offsetMs };
    }, "offset");
    if (outcome === "first") setOffsetPast((stack) => [...stack, before].slice(-40));
  }

  function stepRate(delta: number) {
    const before = timingRef.current.rate;
    const outcome = write((current) => {
      const rate = clampRate(current.rate + delta);
      if (rate === current.rate) return current;
      return { ...current, rate };
    }, "rate");
    if (outcome === "first") setRatePast((stack) => [...stack, before].slice(-40));
  }

  function stepLine(delta: number) {
    const key = selectedKeyRef.current;
    if (!key) return;
    write((current) => withLineShift(current, key, (current.lines?.[key] ?? 0) + delta), "line");
  }

  function stepHold(delta: number) {
    const key = selectedKeyRef.current;
    if (!key) return;
    write((current) => withLineHold(current, key, (current.holds?.[key] ?? 0) + delta), "hold");
  }

  function endGesture() {
    gesture.current = null;
  }

  function pushOffset(nextMs: number) {
    const before = timingRef.current.offsetMs;
    const outcome = write((current) => (current.offsetMs === nextMs ? current : { ...current, offsetMs: nextMs }), "yes");
    if (outcome !== "skip") setOffsetPast((stack) => [...stack, before].slice(-40));
  }

  function pushRate(nextRate: number) {
    const before = timingRef.current.rate;
    const outcome = write((current) => (current.rate === nextRate ? current : { ...current, rate: nextRate }), "yes");
    if (outcome !== "skip") setRatePast((stack) => [...stack, before].slice(-40));
  }

  function editLine(kind: "text" | "trans", key: string, value: string, isComposing: boolean) {
    const recipe = (current: TrackTiming) => (kind === "text" ? withLineText(current, key, value) : withLineTrans(current, key, value));
    if (isComposing || composing.current) {
      if (composeBase.current == null) composeBase.current = timingRef.current;
      composing.current = true;
      write(recipe, "no");
      return;
    }
    if (skipRecord.current) {
      skipRecord.current = false;
      write(recipe, "no");
      return;
    }
    write(recipe, "yes");
  }

  function finishCompose() {
    composing.current = false;
    const base = composeBase.current;
    composeBase.current = null;
    if (!base || sameTiming(base, timingRef.current)) return;
    pushPast(base);
    skipRecord.current = true;
    queueMicrotask(() => {
      skipRecord.current = false;
    });
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
            write((current) => ({ ...current, offsetMs: previous }), "no");
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
            write((current) => ({ ...current, rate: previous }), "no");
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
        <RepeatButton label="−" title="歌詞慢了" kind="ms" sign={-1} disabled={!selected} onStep={stepLine} onRelease={endGesture} />
        <span className="meta read">{formatOffset(selectedShift)}</span>
        <RepeatButton label="＋" title="歌詞快了" kind="ms" sign={1} disabled={!selected} onStep={stepLine} onRelease={endGesture} />
        <IconButton label="重播" disabled={!selected} onClick={() => selected && onReplay(selected)}>
          <ReplayIcon />
        </IconButton>
        <button
          type="button"
          className="tiny"
          disabled={!selected}
          onClick={() => selected && write((current) => withoutLine(current, lineKey(selected)), "yes")}
        >
          重設呢句
        </button>
        <button
          type="button"
          className="tiny"
          title="Delete。原句會藏起，插入句會拿走。"
          disabled={!selected}
          onClick={removeSelected}
        >
          刪除呢句
        </button>
        <button type="button" className="tiny" title="Ctrl+Z" disabled={past.length === 0} onClick={undo}>
          上一步
        </button>
      </div>
      <div className="row">
        <span className="meta">停留</span>
        <RepeatButton
          label="−"
          title="短 0.25 秒，按住會連續減"
          kind="stay"
          sign={-1}
          disabled={!selected}
          onStep={stepHold}
          onRelease={endGesture}
        />
        <span className="meta read">{formatHold(selectedHold)}</span>
        <RepeatButton
          label="＋"
          title="長 0.25 秒，按住會連續加"
          kind="stay"
          sign={1}
          disabled={!selected}
          onStep={stepHold}
          onRelease={endGesture}
        />
      </div>
      <div className="pair">
        <label>
          歌詞
          <input
            type="text"
            disabled={!selected}
            value={selected?.text ?? ""}
            onCompositionStart={() => {
              composing.current = true;
              if (composeBase.current == null) composeBase.current = timingRef.current;
            }}
            onCompositionEnd={finishCompose}
            onChange={(event) => {
              if (!selected) return;
              const native = event.nativeEvent;
              editLine("text", lineKey(selected), event.target.value, native instanceof InputEvent && native.isComposing);
            }}
          />
        </label>
        <label>
          譯文
          <input
            type="text"
            disabled={!selected}
            value={selected?.translatedText ?? ""}
            onCompositionStart={() => {
              composing.current = true;
              if (composeBase.current == null) composeBase.current = timingRef.current;
            }}
            onCompositionEnd={finishCompose}
            onChange={(event) => {
              if (!selected) return;
              const native = event.nativeEvent;
              editLine("trans", lineKey(selected), event.target.value, native instanceof InputEvent && native.isComposing);
            }}
          />
        </label>
      </div>
      <button
        type="button"
        className="tiny"
        onClick={() =>
          write(
            (current) =>
              withAdded(current, {
                atMs: Math.max(0, Math.round(lyricMs)),
                text: "新句",
                id: crypto.randomUUID().replaceAll("-", "").slice(0, 8),
              }),
            "yes",
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
            const current = timingRef.current;
            const next = replaceShown(current, baseLines, clips, tags.offsetMs, tags.rate);
            const outcome = write(() => next, "yes");
            if (outcome === "skip") return;
            if (next.offsetMs !== current.offsetMs) setOffsetPast((stack) => [...stack, current.offsetMs].slice(-40));
            if (next.rate !== current.rate) setRatePast((stack) => [...stack, current.rate].slice(-40));
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
