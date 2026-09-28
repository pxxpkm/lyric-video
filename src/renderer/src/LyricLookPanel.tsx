import { defaultLook, lyricFonts, type LyricLook } from "../../core/lyricLook";

export function LyricLookPanel({ look, onChange }: { look: LyricLook; onChange: (next: LyricLook) => void }) {
  function patch(part: Partial<LyricLook>) {
    onChange({ ...look, ...part });
  }

  return (
    <section className="look">
      <h2>字體</h2>
      <p className="meta span">在畫面上拖動歌詞。下面可以改字級、顏色和裙邊。</p>
      <label className="span">
        字體
        <select value={look.font} onChange={(event) => patch({ font: event.target.value })}>
          {lyricFonts.map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </select>
      </label>
      <Slider label="字級" min={24} max={120} step={1} value={look.size} onChange={(size) => patch({ size })} />
      <Slider
        label="裙邊"
        min={0}
        max={16}
        step={1}
        value={look.outline}
        onChange={(outline) => patch({ outline })}
      />
      <Color label="顏色" value={look.color} onChange={(color) => patch({ color })} />
      <Color label="唱到" value={look.sungColor} onChange={(sungColor) => patch({ sungColor })} />
      <Color label="裙邊顏色" value={look.outlineColor} onChange={(outlineColor) => patch({ outlineColor })} />
      <Slider
        label="譯文大小"
        min={0.4}
        max={0.9}
        step={0.01}
        value={look.transScale}
        onChange={(transScale) => patch({ transScale })}
      />
      <Slider
        label="下一句"
        min={0.05}
        max={1}
        step={0.01}
        value={look.nextOpacity}
        onChange={(nextOpacity) => patch({ nextOpacity })}
      />
      <Slider label="左右" min={0.04} max={0.96} step={0.01} value={look.x} onChange={(x) => patch({ x })} />
      <Slider label="上下" min={0.08} max={0.94} step={0.01} value={look.y} onChange={(y) => patch({ y })} />
      <button type="button" className="span" onClick={() => onChange(defaultLook)}>
        還原字體
      </button>
    </section>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
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
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <input type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} />
    </label>
  );
}
