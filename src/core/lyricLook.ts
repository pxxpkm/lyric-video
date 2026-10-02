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
  /** 字與字之間的額外空位，1080 畫面的像素。原文同譯文共用。0 就同未加之前一樣。 */
  tracking: number;
};

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
  tracking: 0,
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
    tracking: Math.round(clamp(raw.tracking, 0, 8, defaultLook.tracking)),
  };
}

/** 額外字距。未寫、唔係數字、或者負數都當 0，畫面先至唔會相對而家偏移。 */
export function letterGap(tracking: number | undefined): number {
  if (typeof tracking !== "number" || !Number.isFinite(tracking) || tracking <= 0) return 0;
  return tracking;
}

/** 直排字柱每隻字的步進。字距 0 就等於字級。 */
export function glyphStep(size: number, tracking: number | undefined): number {
  return size + letterGap(tracking);
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

export function canvasFont(look: LyricLook, px: number): string {
  const face = lyricFont(look.font).family;
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

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function hex(value: string | undefined, fallback: string): string {
  if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) return value.toUpperCase();
  return fallback;
}
