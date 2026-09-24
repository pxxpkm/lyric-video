import type { Project } from "./project";
import type { TrackTiming } from "./timing";

export function timingForProject(timing: TrackTiming): Project["timing"] {
  return {
    offsetMs: timing.offsetMs,
    rate: timing.rate,
    lines: timing.lines ?? {},
    holds: timing.holds ?? {},
    texts: timing.texts ?? {},
    trans: timing.trans ?? {},
    added: (timing.added ?? []).map((line) => ({
      atMs: line.atMs,
      text: line.text,
      id: line.id,
      ...(line.trans ? { trans: line.trans } : {}),
    })),
  };
}

export function timingFromProject(timing: Project["timing"]): TrackTiming {
  return {
    offsetMs: timing.offsetMs,
    rate: timing.rate,
    lines: Object.keys(timing.lines).length > 0 ? { ...timing.lines } : null,
    holds: Object.keys(timing.holds).length > 0 ? { ...timing.holds } : null,
    texts: Object.keys(timing.texts).length > 0 ? { ...timing.texts } : null,
    trans: Object.keys(timing.trans).length > 0 ? { ...timing.trans } : null,
    added: timing.added.length > 0 ? timing.added.map((line) => ({ ...line })) : null,
  };
}
