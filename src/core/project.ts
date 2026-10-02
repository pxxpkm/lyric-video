import { z } from "zod";
import { defaultLook, pairedTrans, resolvedTransColor, resolvedTransSize } from "./lyricLook";
import { knownPreset, linePresetNames, settleClip } from "./motion";

const wordSchema = z.object({
  startMs: z.number().int(),
  durMs: z.number().int().nonnegative(),
  text: z.string(),
});

const lineSchema = z.object({
  atMs: z.number().int().nonnegative(),
  text: z.string(),
  trans: z.string().default(""),
  words: z.array(wordSchema).default([]),
});

const addedSchema = z.object({
  atMs: z.number().int(),
  text: z.string(),
  id: z.string(),
  trans: z.string().optional(),
});

export const projectSchema = z.object({
  version: z.literal(1),
  source: z.object({
    kind: z.enum(["youtube", "file"]),
    url: z.string().default(""),
    mediaPath: z.string().default(""),
    mode: z.enum(["video", "audio"]),
  }),
  identity: z.object({
    title: z.string(),
    artist: z.string(),
    durationMs: z.number().int().nonnegative(),
    lockTitle: z.boolean(),
    lockArtist: z.boolean(),
  }),
  lyrics: z.object({
    candidateKey: z.string(),
    source: z.string(),
    lines: z.array(lineSchema),
  }),
  timing: z.object({
    offsetMs: z.number().int(),
    rate: z.number().finite(),
    lines: z.record(z.string(), z.number().int()).default({}),
    holds: z.record(z.string(), z.number().int()).default({}),
    texts: z.record(z.string(), z.string()).default({}),
    trans: z.record(z.string(), z.string()).default({}),
    added: z.array(addedSchema).default([]),
  }),
  motion: z
    .array(
      z
        .object({
          id: z.string(),
          text: z.string().default(""),
          startMs: z.number(),
          endMs: z.number(),
          lineKey: z.string().default(""),
          enter: z.object({ x: z.number(), y: z.number(), opacity: z.number() }),
          leave: z.object({ x: z.number(), y: z.number(), opacity: z.number() }),
          locked: z.boolean().optional(),
          basis: z.literal("look").optional(),
          trans: z.object({ x: z.number(), y: z.number() }).optional(),
          preset: z.preprocess((value) => knownPreset(value), z.enum(linePresetNames).optional()),
        })
        .transform((clip) => ({ ...clip, locked: clip.locked ?? true })),
    )
    .default([]),
  style: z.object({
    showTrans: z.boolean(),
    karaoke: z.boolean(),
    font: z.string().default(defaultLook.font),
    size: z.number().default(defaultLook.size),
    color: z.string().default(defaultLook.color),
    sungColor: z.string().default(defaultLook.sungColor),
    outline: z.number().default(defaultLook.outline),
    outlineColor: z.string().default(defaultLook.outlineColor),
    transSize: z.number().optional(),
    transColor: z.string().optional(),
    flow: z.preprocess(
      (value) => (value === "left" || value === "right" ? "vertical" : value),
      z.enum(["horizontal", "vertical"]).default("horizontal"),
    ),
    x: z.number().default(defaultLook.x),
    y: z.number().default(defaultLook.y),
    transX: z.number().optional(),
    transY: z.number().optional(),
  }),
  decision: z.object({
    autoAccepted: z.boolean(),
    score: z.number(),
    reason: z.string(),
  }),
});

export type Project = z.infer<typeof projectSchema>;

export function parseProject(input: unknown): Project {
  const project = projectSchema.parse(input);
  const saved = { x: project.style.x, y: project.style.y };
  const motion = project.motion.map((clip) => settleClip(clip, saved));
  return {
    ...project,
    style: withTransPaint(withTransAnchor(undoParkedFlow(project.style, rawStyleFlow(input))), rawStyleRecord(input)),
    motion,
  };
}

function withTransPaint(style: Project["style"], raw: Record<string, unknown> | null): Project["style"] {
  const scale = raw && typeof raw.transScale === "number" ? raw.transScale : undefined;
  return {
    ...style,
    transSize: resolvedTransSize(style.size, style.transSize, scale),
    transColor: resolvedTransColor(style.color, style.transColor),
  };
}

function rawStyleRecord(input: unknown): Record<string, unknown> | null {
  if (input == null || typeof input !== "object" || !("style" in input)) return null;
  const style = input.style;
  if (style == null || typeof style !== "object") return null;
  return style as Record<string, unknown>;
}

function withTransAnchor(style: Project["style"]): Project["style"] {
  if (typeof style.transX === "number" && typeof style.transY === "number") return style;
  const paired = pairedTrans(style);
  return {
    ...style,
    transX: typeof style.transX === "number" ? style.transX : paired.transX,
    transY: typeof style.transY === "number" ? style.transY : paired.transY,
  };
}

const parkedFlow = {
  left: { x: 0.1, y: 0.5 },
  right: { x: 0.9, y: 0.5 },
} as const;

function rawStyleFlow(input: unknown): unknown {
  if (input == null || typeof input !== "object" || !("style" in input)) return undefined;
  const style = input.style;
  if (style == null || typeof style !== "object" || !("flow" in style)) return undefined;
  return style.flow;
}

function undoParkedFlow(style: Project["style"], rawFlow: unknown): Project["style"] {
  if (rawFlow !== "left" && rawFlow !== "right") return style;
  const anchor = parkedFlow[rawFlow];
  const parked = Math.abs(style.x - anchor.x) < 0.021 && Math.abs(style.y - anchor.y) < 0.021;
  if (!parked) return style;
  return { ...style, x: defaultLook.x, y: defaultLook.y };
}

export function exampleProject(): Project {
  return {
    version: 1,
    source: { kind: "file", url: "", mediaPath: "", mode: "video" },
    identity: {
      title: "",
      artist: "",
      durationMs: 0,
      lockTitle: false,
      lockArtist: false,
    },
    lyrics: { candidateKey: "", source: "", lines: [] },
    timing: {
      offsetMs: 0,
      rate: 1,
      lines: {},
      holds: {},
      texts: {},
      trans: {},
      added: [],
    },
    style: {
      showTrans: true,
      karaoke: true,
      font: defaultLook.font,
      size: defaultLook.size,
      color: defaultLook.color,
      sungColor: defaultLook.sungColor,
      outline: defaultLook.outline,
      outlineColor: defaultLook.outlineColor,
      transSize: defaultLook.transSize,
      transColor: defaultLook.transColor,
      flow: "horizontal",
      x: defaultLook.x,
      y: defaultLook.y,
      transX: defaultLook.transX,
      transY: defaultLook.transY,
    },
    motion: [],
    decision: { autoAccepted: false, score: 0, reason: "" },
  };
}
