import {
  columnGapMax,
  columnGapMin,
  columnGapOf,
  defaultLook,
  isVerticalFlow,
  lyricBlur,
  lyricFonts,
  softBlurMax,
  type LyricFlow,
  type LyricLook,
} from "../../core/lyricLook";

export function LyricLookPanel({ look, onChange }: { look: LyricLook; onChange: (next: LyricLook) => void }) {
  function patch(part: Partial<LyricLook>) {
    onChange({ ...look, ...part });
  }

  return (
    <>
      <p className="meta span">原文同譯文各自有字體、字級、顏色同成首位置。改一邊唔會帶動另一邊，已經單獨擺過的句子保持距離。</p>
      <label className="span">
        排列
        <select
          value={isVerticalFlow(look.flow) ? "vertical" : "horizontal"}
          onChange={(event) => patch({ flow: event.target.value as LyricFlow })}
        >
          <option value="horizontal">橫排</option>
          <option value="vertical">垂直</option>
        </select>
      </label>
      <p className="meta span">垂直由上寫到下，逐隻字疊住。橫排都一樣，原文同譯文可以分開擺。例如日文放左側、中文放右側。</p>
      <label className="span">
        原文字體
        <select value={look.font} onChange={(event) => patch({ font: event.target.value })}>
          {lyricFonts.map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </select>
      </label>
      <label className="span">
        譯文字體
        <select value={look.transFont} onChange={(event) => patch({ transFont: event.target.value })}>
          {lyricFonts.map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </select>
      </label>
      <p className="meta span">譯文可以另揀一款。未寫過的舊檔，譯文跟原文。裙邊、字距、柔邊仍然共用。</p>
      <Slider label="原文字級" min={24} max={120} step={1} value={look.size} onChange={(size) => patch({ size })} />
      <Color label="原文顏色" value={look.color} onChange={(color) => patch({ color })} />
      <Color label="原文唱到" value={look.sungColor} onChange={(sungColor) => patch({ sungColor })} />
      <Slider label="譯文字級" min={24} max={120} step={1} value={look.transSize} onChange={(transSize) => patch({ transSize })} />
      <Color label="譯文顏色" value={look.transColor} onChange={(transColor) => patch({ transColor })} />
      <Slider
        label="裙邊"
        min={0}
        max={16}
        step={1}
        value={look.outline}
        onChange={(outline) => patch({ outline })}
      />
      <Color label="裙邊顏色" value={look.outlineColor} onChange={(outlineColor) => patch({ outlineColor })} />
      <Slider label="字距" min={0} max={8} step={1} value={look.tracking ?? 0} onChange={(tracking) => patch({ tracking })} />
      <p className="meta span">0 同而家一樣。拉高就喺字與字之間加空位，直排就沿住字柱拉開。原文同譯文共用。預覽同成片都用。</p>
      <Slider
        label="成片間距"
        min={columnGapMin}
        max={columnGapMax}
        step={1}
        value={columnGapOf(look.columnGap)}
        onChange={(columnGap) => patch({ columnGap })}
      />
      <p className="meta span">
        而家 {columnGapOf(look.columnGap)}。只影響直排匯出。0 貼住量到的臨界。預設 −2，再密兩點。負數更密，正數更疏。預覽未改。原文同譯文共用。
      </p>
      <Slider
        label="柔邊"
        min={0}
        max={softBlurMax}
        step={0.5}
        value={lyricBlur(look.soft, look.softBlur)}
        onChange={(amount) => patch({ softBlur: amount, soft: amount > 0 })}
      />
      <p className="meta span">0 就同關閉一樣。拉高就全首歌詞更模糊。小點保持清晰。原文同譯文共用。</p>
      <Slider label="原文左右" min={0} max={1} step={0.01} value={look.x} onChange={(x) => patch({ x })} />
      <Slider label="原文上下" min={0.08} max={0.94} step={0.01} value={look.y} onChange={(y) => patch({ y })} />
      <Slider label="譯文左右" min={0} max={1} step={0.01} value={look.transX} onChange={(transX) => patch({ transX })} />
      <Slider label="譯文上下" min={0.08} max={0.94} step={0.01} value={look.transY} onChange={(transY) => patch({ transY })} />
      <button type="button" className="span" onClick={() => onChange(defaultLook)}>
        還原字體
      </button>
    </>
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
