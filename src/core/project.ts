import { z } from "zod";

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
    font: z.string(),
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
    style: { showTrans: true, karaoke: true, font: "ChironGoRoundTC" },
    decision: { autoAccepted: false, score: 0, reason: "" },
  };
}
