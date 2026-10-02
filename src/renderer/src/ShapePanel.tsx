import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { applyEdits, lineKey, type LyricLine } from "../../core/lyrics";
import type { LyricLook } from "../../core/lyricLook";
import {
  clearLineMotion,
  clearLineMotions,
  edgeFadeMs,
  fadeRequest,
  mediaSpans,
  setLineFade,
  setLinePreset,
  setLinesFade,
  setLinesPreset,
  type LinePreset,
  type MotionClip,
} from "../../core/motion";
import type { TrackTiming } from "../../core/timing";
import { LineList } from "./LineList";
import { LyricLookPanel } from "./LyricLookPanel";

export function ShapePanel({
  baseLines,
  timing,
  clips,
  look,
  selectedKey,
  pick,
  onSelect,
  onClips,
  onLook,
  onAllChange,
}: {
  baseLines: LyricLine[];
  timing: TrackTiming;
  clips: MotionClip[];
  look: LyricLook;
  selectedKey: string | null;
  pick: number;
  onSelect: (key: string) => void;
  onClips: (next: MotionClip[]) => void;
  onLook: (next: LyricLook) => void;
  onAllChange?: (on: boolean) => void;
}) {
  const shown = useMemo(() => applyEdits(baseLines, timing), [baseLines, timing]);
  const [allOn, setAllOn] = useState(false);
  const onAllChangeRef = useRef(onAllChange);
  onAllChangeRef.current = onAllChange;
  const songKey = shown.map((line) => lineKey(line)).join("\n");
  useEffect(() => {
    setAllOn(false);
    onAllChangeRef.current?.(false);
  }, [pick, songKey]);
  const selected = shown.find((line) => lineKey(line) === selectedKey) ?? null;
  const spans = useMemo(() => mediaSpans(shown, timing), [shown, timing]);
  const targets = useMemo(
    () =>
      shown.flatMap((line) => {
        const span = spans.get(lineKey(line));
        return span ? [{ lineKey: lineKey(line), text: line.text, startMs: span.startMs, endMs: span.endMs }] : [];
      }),
    [shown, spans],
  );
  const span = selected ? spans.get(lineKey(selected)) : undefined;
  const lineClip = selected ? clips.find((clip) => clip.lineKey === lineKey(selected)) : undefined;
  const fadeIn = allOn ? sharedFade(clips, targets, "in") : fadeRequest(lineClip, "in");
  const fadeOut = allOn ? sharedFade(clips, targets, "out") : fadeRequest(lineClip, "out");
  const preset = allOn ? sharedPreset(clips, targets) : (lineClip?.preset ?? null);
  const canPlace = allOn ? targets.length > 0 : selected != null && span != null;
  const canClear = allOn ? targets.some((line) => clips.some((clip) => clip.lineKey === line.lineKey)) : lineClip != null;

  function fadeLine(edge: "in" | "out", amount: number) {
    if (allOn) {
      onClips(setLinesFade(clips, targets, edge, amount));
      return;
    }
    if (!selected || !span) return;
    onClips(setLineFade(clips, lineKey(selected), selected.text, span.startMs, span.endMs, edge, amount));
  }

  function choosePreset(next: LinePreset | null) {
    if (allOn) {
      onClips(setLinesPreset(clips, targets, next));
      return;
    }
    if (!selected || !span) return;
    onClips(setLinePreset(clips, lineKey(selected), selected.text, span.startMs, span.endMs, next));
  }

  function followLook() {
    if (allOn) {
      onClips(clearLineMotions(clips, targets.map((line) => line.lineKey)));
      return;
    }
    if (selected) onClips(clearLineMotion(clips, lineKey(selected)));
  }

  return (
    <div className="folds">
      <Fold title="字體">
        <LyricLookPanel look={look} onChange={onLook} />
      </Fold>
      <Fold title="效果" initial>
        <p className="meta span">揀一句再改句頭句尾的淡入淡出同預設，或者撳全選一齊改。位置用上面的字體，或者喺預覽拖。這裡不改時間。</p>
        <div className="span">
          <LineList
            lines={shown}
            timing={timing}
            selectedKey={selectedKey}
            allSelected={allOn}
            onSelectAll={() =>
              setAllOn((value) => {
                const next = !value;
                onAllChangeRef.current?.(next);
                return next;
              })
            }
            onSelect={(key) => {
              setAllOn(false);
              onAllChangeRef.current?.(false);
              onSelect(key);
            }}
          />
        </div>
        <p className="meta span">
          {allOn
            ? "已全選。喺預覽拖原文，全部原文一齊走；拖譯文，全部譯文一齊走。再撳一次全選，或揀返一句，就回到逐句。"
            : selected
              ? selected.text
              : "尚未選句。還沒單獨擺過的句子，停在成首位置。"}
        </p>
        <div className="presets span">
          {(
            [
              [null, "無"],
              ["fly", "飛入"],
              ["scale", "放大"],
              ["turn", "擺正"],
              ["tint", "變色"],
              ["edge", "漸邊"],
              ["dust", "微塵"],
              ["glow", "光斑"],
              ["arc", "弧線"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={label}
              type="button"
              className={preset === id ? "tiny on" : "tiny"}
              disabled={!canPlace}
              onClick={() => choosePreset(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="meta span">
          {preset === "mixed"
            ? "呢幾句預設唔同。再揀一個就全部用同一個。"
            : "飛入由下移上。放大、擺正同變色都喺句頭。漸邊沿住成句改裙邊色。微塵、光斑、弧線沿住成句，小點細啲而且錯開。預設會燒進入面。"}
        </p>
        <div className="row span">
          <Range label="淡入" min={0} max={800} step={10} value={fadeIn} disabled={!canPlace} onChange={(amount) => fadeLine("in", amount)} />
          <Range label="淡出" min={0} max={800} step={10} value={fadeOut} disabled={!canPlace} onChange={(amount) => fadeLine("out", amount)} />
          <button
            type="button"
            className="tiny"
            disabled={!canClear}
            title={allOn ? "所有句子的原文同譯文回到成首位置，預設同淡入淡出一併清掉" : "呢句原文同譯文回到成首位置，預設同淡入淡出一併清掉"}
            onClick={followLook}
          >
            跟字體
          </button>
        </div>
        <p className="meta span">0 係直接切換。50 係句頭句尾各淡一截，中間保持清楚。</p>
      </Fold>
    </div>
  );
}

function sharedPreset(clips: MotionClip[], lines: { lineKey: string }[]): LinePreset | null | "mixed" {
  if (lines.length === 0) return null;
  const values = lines.map((line) => clips.find((item) => item.lineKey === line.lineKey)?.preset ?? null);
  const first = values[0];
  return values.every((value) => value === first) ? first : "mixed";
}

function sharedFade(
  clips: MotionClip[],
  lines: { lineKey: string }[],
  edge: "in" | "out",
): number {
  if (lines.length === 0) return edgeFadeMs;
  const amounts = lines.map((line) => fadeRequest(clips.find((item) => item.lineKey === line.lineKey), edge));
  const first = amounts[0];
  return amounts.every((amount) => amount === first) ? first : edgeFadeMs;
}

function Fold({ title, initial = false, children }: { title: string; initial?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initial);
  return (
    <section className="fold">
      <button type="button" className="fold-head" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>{title}</span>
        <span>{open ? "收起" : "展開"}</span>
      </button>
      {open ? <div className="fold-body look">{children}</div> : null}
    </section>
  );
}

function Range({
  label,
  min = 0.02,
  max = 0.98,
  step = 0.01,
  value,
  disabled,
  onChange,
}: {
  label: string;
  min?: number;
  max?: number;
  step?: number;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
