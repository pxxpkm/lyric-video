import { z } from "zod";
import { defaultLook } from "./lyricLook";

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
  style: z.object({
    showTrans: z.boolean(),
    karaoke: z.boolean(),
    font: z.string().default(defaultLook.font),
    size: z.number().default(defaultLook.size),
    color: z.string().default(defaultLook.color),
    sungColor: z.string().default(defaultLook.sungColor),
    outline: z.number().default(defaultLook.outline),
    outlineColor: z.string().default(defaultLook.outlineColor),
    transScale: z.number().default(defaultLook.transScale),
    nextOpacity: z.number().default(defaultLook.nextOpacity),
    x: z.number().default(defaultLook.x),
    y: z.number().default(defaultLook.y),
  }),
  decision: z.object({
    autoAccepted: z.boolean(),
    score: z.number(),
    reason: z.string(),
  }),
});

export type Project = z.infer<typeof projectSchema>;

export function parseProject(input: unknown): Project {
  return projectSchema.parse(input);
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
      transScale: defaultLook.transScale,
      nextOpacity: defaultLook.nextOpacity,
      x: defaultLook.x,
      y: defaultLook.y,
    },
    decision: { autoAccepted: false, score: 0, reason: "" },
  };
}
