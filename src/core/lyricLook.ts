export type LyricFont = { id: string; label: string; family: string; ass: string };

export const lyricFonts: readonly LyricFont[] = [
  { id: "chiron", label: "昭源圓體", family: "Chiron GoRound TC", ass: "Chiron GoRound TC" },
  { id: "jhenghei", label: "微軟正黑體", family: "Microsoft JhengHei", ass: "Microsoft JhengHei" },
  { id: "yahei", label: "微軟雅黑", family: "Microsoft YaHei", ass: "Microsoft YaHei" },
  { id: "kai", label: "標楷體", family: "KaiTi", ass: "KaiTi" },
];

export type LyricFlow = "horizontal" | "vertical";

export type LyricLook = {
  font: string;
  size: number;
  color: string;
  sungColor: string;
  outline: number;
  outlineColor: string;
  transSize: number;
  transColor: string;
  flow: LyricFlow;
  x: number;
  y: number;
  transX: number;
  transY: number;
  /** 譯文款式。未寫就跟原文。寫咗之後改原文唔會再帶動。 */
  transFont: string;
  /** 字與字之間的額外空位，1080 畫面的像素。原文同譯文共用。0 就同未加之前一樣。 */
  tracking: number;
  /** 全首歌詞的柔邊。小點不加。 */
  soft: boolean;
  /** 1080 畫面的高斯模糊。0 就同關閉一樣。原文同譯文共用。 */
  softBlur: number;
  /** 直排成片每隻字再加的空位。0 貼住量到的臨界。負數更密。預覽唔用。 */
  columnGap: number;
};

/** 未寫過程度、但已經開過柔邊時用。參考檔喺 720p 用 4，呢度用較輕的 1.5，避免同裙邊疊到發糊。 */
export const softBlur = 1.5;

/** 柔邊拉桿的上限。 */
export const softBlurMax = 4;

/** 直排成片間距。0 係量到的臨界。預設再密 2 點，最高那隻字會輕輕貼入。 */
export const columnGapMin = -8;
export const columnGapMax = 8;
export const defaultColumnGap = -2;

/** 同樣式邊距一樣。收窄留呢條白邊，字先至唔貼住畫面。 */
export const frameEdge = 40;

export const playWidth = 1920;
export const playHeight = 1080;

/** 舊檔只有譯文比例、未有譯文字級時用。64 × 0.56 = 36。 */
const legacyTransScale = 0.56;

export const defaultLook: LyricLook = {
  font: "chiron",
  size: 64,
  color: "#E8D7C4",
  sungColor: "#F0D78C",
  outline: 6,
  outlineColor: "#1B140C",
  transSize: Math.round(64 * legacyTransScale),
  transColor: "#E8D7C4",
  flow: "horizontal",
  x: 0.5,
  y: 0.82,
  transX: 0.5,
  transY: 0.82 + (64 * 1.25) / 1080,
  transFont: "chiron",
  tracking: 0,
  soft: false,
  softBlur: 0,
  columnGap: defaultColumnGap,
};

const aliases: Record<string, string> = {
  chirongoroundtc: "chiron",
  "chiron goround tc": "chiron",
};

export function lyricFont(id: string | null | undefined): LyricFont {
  const key = (id ?? "").trim().toLowerCase();
  const mapped = aliases[key] ?? key;
  return lyricFonts.find((font) => font.id === mapped) ?? lyricFonts[0];
}

/** 未寫、空白就跟原文。寫咗就用自己的款，之後改原文唔會再帶動。 */
export function resolvedTransFont(fontId: string | null | undefined, transFont: string | null | undefined): string {
  const main = lyricFont(fontId).id;
  if (typeof transFont !== "string" || transFont.trim() === "") return main;
  return lyricFont(transFont).id;
}

export function clampLook(input: (Partial<LyricLook> & { transScale?: number }) | null | undefined): LyricLook {
  const raw = input ?? {};
  const size = clamp(raw.size, 24, 120, defaultLook.size);
  const color = hex(raw.color, defaultLook.color);
  return {
    font: lyricFont(raw.font).id,
    size,
    color,
    sungColor: hex(raw.sungColor, defaultLook.sungColor),
    outline: clamp(raw.outline, 0, 16, defaultLook.outline),
    outlineColor: hex(raw.outlineColor, defaultLook.outlineColor),
    transSize: resolvedTransSize(size, raw.transSize, raw.transScale),
    transColor: resolvedTransColor(color, raw.transColor),
    flow: flowOf(raw.flow),
    x: clamp(raw.x, 0, 1, defaultLook.x),
    y: clamp(raw.y, 0.08, 0.94, defaultLook.y),
    transX: clamp(raw.transX, 0, 1, defaultLook.transX),
    transY: clamp(raw.transY, 0.08, 0.94, defaultLook.transY),
    transFont: resolvedTransFont(raw.font, raw.transFont),
    tracking: Math.round(clamp(raw.tracking, 0, 8, defaultLook.tracking)),
    soft: lyricBlur(raw.soft, raw.softBlur) > 0,
    softBlur: lyricBlur(raw.soft, raw.softBlur),
    columnGap: columnGapOf(raw.columnGap),
  };
}

/** 未寫就用預設 −2。寫低的 0 係臨界，要保留。 */
export function columnGapOf(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return defaultColumnGap;
  const clamped = Math.min(columnGapMax, Math.max(columnGapMin, value));
  return Math.round(clamped);
}

/** 寫低的程度優先。未寫時，開過就用 1.5，否則 0。0 係關閉，要寫低。 */
export function lyricBlur(soft: boolean | undefined, amount: number | undefined): number {
  if (typeof amount === "number" && Number.isFinite(amount)) return snapSoftBlur(amount);
  return soft === true ? softBlur : 0;
}

function snapSoftBlur(amount: number): number {
  const clamped = Math.min(softBlurMax, Math.max(0, amount));
  return Math.round(clamped * 2) / 2;
}

/** 額外字距。未寫、唔係數字、或者負數都當 0，畫面先至唔會相對而家偏移。 */
export function letterGap(tracking: number | undefined): number {
  if (typeof tracking !== "number" || !Number.isFinite(tracking) || tracking <= 0) return 0;
  return tracking;
}

/** 直排字柱每隻字的步進。字距 0 就等於字級。預覽用呢個數，筆畫置中，裙邊只有一半伸出字格。 */
export function glyphStep(size: number, tracking: number | undefined): number {
  return size + letterGap(tracking);
}

/**
 * 成片最高那隻字，超出「字級 + 兩倍裙邊」的點數。libass 量過，這段唔跟字級變長。
 * 昭源、正黑、雅黑在字級 40 到 120、裙邊 6 剛剛貼住，所以係 4。字級 64 的臨界步進係 80。
 * 字級 24 只超出 2，用 4 會剩 2 點，避免再低過較大字級的臨界。
 * 標楷只量過字級 64 的「中」，實高 86，所以係 10。
 * 收窄唔縮這段，亦不縮裙邊。預覽仍然用 glyphStep。
 */
const verticalExtra: Record<string, number> = {
  chiron: 4,
  jhenghei: 4,
  yahei: 4,
  kai: 10,
};

export function verticalPitch(
  size: number,
  tracking: number | undefined,
  outline: number,
  used = 1,
  fontId?: string,
  gap?: number,
): number {
  const scale = shrink(used);
  return glyphBox(size, outline, fontId, gap, scale) + letterGap(tracking) * scale;
}

/** 成片直排成柱高度。字距只加在字與字之間。每隻字的臨界超出唔跟收窄。 */
export function verticalInk(
  count: number,
  size: number,
  tracking: number | undefined,
  outline: number,
  used = 1,
  fontId?: string,
  gap?: number,
): number {
  const n = whole(count);
  if (n <= 0) return 0;
  const scale = shrink(used);
  const occupied = glyphBox(size, outline, fontId, gap, scale);
  return n * occupied + Math.max(0, n - 1) * letterGap(tracking) * scale;
}

/** 一行字墨加兩側裙邊。橫排成句，同預覽直排，用呢個數。成片直排見 verticalInk。 */
export function lineInk(count: number, size: number, tracking: number | undefined, outline: number): number {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (n <= 0) return 0;
  const body = Number.isFinite(size) && size > 0 ? size : 0;
  const edge = Number.isFinite(outline) && outline > 0 ? outline : 0;
  return n * body + Math.max(0, n - 1) * letterGap(tracking) + edge * 2;
}

/** 定位兩邊較短嗰邊，減邊距再乘二。拖離中間，兩頭都仲喺畫面入面。 */
export function frameRoom(anchor: number, frame: number, margin = frameEdge): number {
  const span = Number.isFinite(frame) && frame > 0 ? frame : 1;
  const pos = unit(anchor) * span;
  const pad = Number.isFinite(margin) ? margin : frameEdge;
  return Math.max(1, (Math.min(pos, span - pos) - pad) * 2);
}

/**
 * 100 表示放得落，唔使收。否則向下取整，避免四捨五入之後仍然超出。
 * 橫排用畫面闊。預覽直排用畫面高，仍然係成句外圍兩側裙邊。
 */
export function fitPercent(
  count: number,
  size: number,
  tracking: number | undefined,
  outline: number,
  anchor: number,
  frame: number,
): number {
  const ink = lineInk(count, size, tracking, outline);
  const room = frameRoom(anchor, frame);
  if (!(ink > room)) return 100;
  return Math.max(1, Math.floor((room / ink) * 100));
}

/**
 * 成片直排先用。100 表示連每隻字自己的裙邊都放得落。
 * 裙邊唔跟收窄，所以只縮字級同字距。
 */
export function verticalFitPercent(
  count: number,
  size: number,
  tracking: number | undefined,
  outline: number,
  anchor: number,
  frame: number,
  fontId?: string,
  gap?: number,
): number {
  const full = verticalInk(count, size, tracking, outline, 1, fontId, gap);
  const room = frameRoom(anchor, frame);
  if (!(full > room)) return 100;
  const borders = whole(count) * Math.max(0, band(outline) * 2 + extraOf(fontId) + spare(gap));
  const body = full - borders;
  if (!(body > 0) || borders >= room) return 1;
  return Math.max(1, Math.floor(((room - borders) / body) * 100));
}

/** 收窄比例。100 就係 1，短句的位置同字級先至唔會偏移。 */
export function fitUsed(percent: number): number {
  if (!Number.isFinite(percent) || percent >= 100) return 1;
  return Math.max(1, Math.floor(percent)) / 100;
}

/** 橫排只縮闊度。100 就唔寫標籤，輸出先至同未收窄一樣。 */
export function fitWidthTag(percent: number): string {
  if (!Number.isFinite(percent) || percent >= 100) return "";
  return `\\fscx${Math.max(1, Math.floor(percent))}`;
}

export function resolvedTransColor(color: string | undefined, transColor: string | undefined): string {
  const main = hex(color, defaultLook.color);
  return hex(transColor, main);
}

/** 已有譯文字級就用它。舊檔只得比例時，用原文大小乘比例，之後兩邊各自改。 */
export function resolvedTransSize(size: number, transSize: number | undefined, transScale: number | undefined): number {
  if (typeof transSize === "number" && Number.isFinite(transSize)) return clamp(transSize, 24, 120, defaultLook.transSize);
  const scale = typeof transScale === "number" && Number.isFinite(transScale) ? transScale : legacyTransScale;
  const basis = Number.isFinite(size) ? size : defaultLook.size;
  return clamp(Math.round(basis * scale), 24, 120, defaultLook.transSize);
}

/** 舊檔未分開譯文位置時，用以前的間距補上。之後各自調，唔再跟住原文。 */
export function pairedTrans(look: { x: number; y: number; size: number; flow?: string }): { transX: number; transY: number } {
  const size = typeof look.size === "number" && Number.isFinite(look.size) ? look.size : defaultLook.size;
  if (isVerticalFlow(look.flow)) {
    return {
      transX: clamp(look.x + (size * 1.25) / 1920, 0, 1, look.x),
      transY: clamp(look.y, 0.08, 0.94, defaultLook.y),
    };
  }
  return {
    transX: clamp(look.x, 0, 1, defaultLook.x),
    transY: clamp(look.y + (size * 1.25) / 1080, 0.08, 0.94, defaultLook.y),
  };
}

export function moveLook(look: LyricLook, dx: number, dy: number): LyricLook {
  return clampLook({
    ...look,
    x: look.x + dx,
    y: look.y + dy,
    transX: look.transX + dx,
    transY: look.transY + dy,
  });
}

export function assColor(hexColor: string): string {
  const safe = hex(hexColor, "#000000").slice(1);
  return `&H00${safe.slice(4, 6)}${safe.slice(2, 4)}${safe.slice(0, 2)}&`.toUpperCase();
}

export function mixHex(from: string, to: string, t: number): string {
  if (t <= 0) return from;
  const a = rgb(from);
  const b = rgb(to);
  const u = Math.min(1, t);
  const channel = (index: number) => Math.round(a[index] + (b[index] - a[index]) * u).toString(16).padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/** 句頭用裙邊色，句尾用唱到色。只有一字就保持裙邊色。 */
export function edgeOutlineAt(from: string, to: string, index: number, count: number): string {
  if (count <= 1) return from;
  return mixHex(from, to, index / (count - 1));
}

function rgb(hexColor: string): [number, number, number] {
  const safe = hexColor.replace("#", "").slice(0, 6).padEnd(6, "0");
  return [
    Number.parseInt(safe.slice(0, 2), 16) || 0,
    Number.parseInt(safe.slice(2, 4), 16) || 0,
    Number.parseInt(safe.slice(4, 6), 16) || 0,
  ];
}

export function canvasFont(look: LyricLook, px: number, fontId?: string): string {
  const face = lyricFont(fontId ?? look.font).family;
  return `${Math.max(1, px)}px "${face}", "Microsoft JhengHei", sans-serif`;
}

// ffmpeg 在 1920×1080、\fs64 時「國」的可見高度。預覽的字級是整格 em，成片要放大才追得上。
const assInkAt64: Record<string, number> = {
  chiron: 20,
  jhenghei: 42,
  yahei: 45,
  kai: 51,
};

export function assFontScale(fontId: string): number {
  const ink = assInkAt64[lyricFont(fontId).id] ?? 42;
  if (ink <= 0) return 1;
  return 64 / ink;
}

export function assFontSize(size: number, fontId: string): number {
  return Math.max(1, Math.round(size * assFontScale(fontId)));
}

export function isVerticalFlow(flow: string | undefined): boolean {
  return flow === "vertical" || flow === "left" || flow === "right";
}

function flowOf(value: string | undefined): LyricFlow {
  return isVerticalFlow(value) ? "vertical" : "horizontal";
}

function whole(count: number): number {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function band(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function shrink(used: number): number {
  return Number.isFinite(used) && used > 0 && used < 1 ? used : 1;
}

function extraOf(fontId: string | undefined): number {
  return verticalExtra[lyricFont(fontId ?? "chiron").id] ?? verticalExtra.chiron;
}

/** 未傳就當 0，方便對住臨界。成片要另外傳 columnGap。 */
function spare(gap: number | undefined): number {
  if (typeof gap !== "number" || !Number.isFinite(gap)) return 0;
  return columnGapOf(gap);
}

function glyphBox(size: number, outline: number, fontId: string | undefined, gap: number | undefined, scale: number): number {
  return Math.max(1, band(size) * scale + band(outline) * 2 + extraOf(fontId) + spare(gap));
}

function unit(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function hex(value: string | undefined, fallback: string): string {
  if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) return value.toUpperCase();
  return fallback;
}
