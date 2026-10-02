import { useState } from "react";
import { formatStamp, lineKey, timeOfMs, type LyricLine } from "../../core/lyrics";
import { mediaMsForLyric } from "../../core/preview";
import { formatHold, formatOffset, type TrackTiming } from "../../core/timing";

const ROW = 58;

export function LineList({
  lines,
  timing,
  selectedKey,
  onSelect,
  allSelected = false,
  onSelectAll,
}: {
  lines: LyricLine[];
  timing: TrackTiming;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  allSelected?: boolean;
  onSelectAll?: () => void;
}) {
  const [scroll, setScroll] = useState(0);
  const height = 220;
  const start = Math.max(0, Math.floor(scroll / ROW) - 1);
  const count = Math.ceil(height / ROW) + 3;
  const slice = lines.slice(start, start + count);
  return (
    <div className="line-column">
      {onSelectAll ? (
        <button
          type="button"
          className={allSelected ? "tiny on" : "tiny"}
          aria-pressed={allSelected}
          disabled={lines.length === 0}
          title="揀晒所有句子，一齊改位置和淡入淡出"
          onClick={onSelectAll}
        >
          全選
        </button>
      ) : null}
      <div className="lines" onScroll={(event) => setScroll(event.currentTarget.scrollTop)}>
        <div style={{ height: Math.max(lines.length, 1) * ROW, position: "relative" }}>
        {lines.length === 0 ? <p className="meta">尚未有歌詞</p> : null}
        {slice.map((line, index) => {
          const key = lineKey(line);
          return (
            <button
              key={`${key}-${start + index}`}
              type="button"
              className={allSelected || key === selectedKey ? "pick-row selected" : "pick-row"}
              style={{ top: (start + index) * ROW }}
              title={lineTitle(line)}
              onClick={() => onSelect(key)}
            >
              <span className="when">{lineWhen(line, timing)}</span>
              <span className="words">
                <span>{line.text}</span>
                {line.translatedText ? <span className="trans">{line.translatedText}</span> : null}
              </span>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}

function lineWhen(line: LyricLine, timing: TrackTiming): string {
  const key = lineKey(line);
  const at = Math.round(mediaMsForLyric(timeOfMs(line, timing.lines), timing.offsetMs, timing.rate));
  const shift = timing.lines?.[key] ?? 0;
  const hold = timing.holds?.[key] ?? 0;
  let mark = formatStamp(at);
  if (shift !== 0) mark += ` ${formatOffset(shift)}`;
  if (hold !== 0) mark += ` 停留${formatHold(hold)}`;
  return mark;
}

function lineTitle(line: LyricLine): string {
  return line.translatedText ? `${line.text}\n${line.translatedText}` : line.text;
}
