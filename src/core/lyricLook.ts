export type LyricFont = { id: string; label: string; family: string; ass: string };

export const lyricFonts: readonly LyricFont[] = [
  { id: "chiron", label: "昭源圓體", family: "Chiron GoRound TC", ass: "Chiron GoRound TC" },
  { id: "jhenghei", label: "微軟正黑體", family: "Microsoft JhengHei", ass: "Microsoft JhengHei" },
  { id: "yahei", label: "微軟雅黑", family: "Microsoft YaHei", ass: "Microsoft YaHei" },
  { id: "kai", label: "標楷體", family: "KaiTi", ass: "KaiTi" },
];

export type LyricLook = {
  font: string;
  size: number;
  color: string;
  sungColor: string;
  outline: number;
  outlineColor: string;
  transScale: number;
  nextOpacity: number;
  x: number;
  y: number;
};

export const defaultLook: LyricLook = {
  font: "chiron",
  size: 64,
  color: "#E8D7C4",
  sungColor: "#F0D78C",
  outline: 6,
  outlineColor: "#1B140C",
  transScale: 0.56,
  nextOpacity: 0.4,
  x: 0.5,
  y: 0.82,
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

export function clampLook(input: Partial<LyricLook> | null | undefined): LyricLook {
  const raw = input ?? {};
  return {
    font: lyricFont(raw.font).id,
    size: clamp(raw.size, 24, 120, defaultLook.size),
    color: hex(raw.color, defaultLook.color),
    sungColor: hex(raw.sungColor, defaultLook.sungColor),
    outline: clamp(raw.outline, 0, 16, defaultLook.outline),
    outlineColor: hex(raw.outlineColor, defaultLook.outlineColor),
    transScale: clamp(raw.transScale, 0.4, 0.9, defaultLook.transScale),
    nextOpacity: clamp(raw.nextOpacity, 0.05, 1, defaultLook.nextOpacity),
    x: clamp(raw.x, 0.04, 0.96, defaultLook.x),
    y: clamp(raw.y, 0.08, 0.94, defaultLook.y),
  };
}

export function moveLook(look: LyricLook, dx: number, dy: number): LyricLook {
  return clampLook({ ...look, x: look.x + dx, y: look.y + dy });
}

export function assColor(hexColor: string): string {
  const safe = hex(hexColor, "#000000").slice(1);
  return `&H00${safe.slice(4, 6)}${safe.slice(2, 4)}${safe.slice(0, 2)}&`.toUpperCase();
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

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function hex(value: string | undefined, fallback: string): string {
  if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) return value.toUpperCase();
  return fallback;
}
