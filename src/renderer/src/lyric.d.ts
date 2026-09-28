import type { ProbeResult, SaveRequest, SaveResult } from "../../shared/import";
import type { MatchResult } from "../../shared/pick";
import type { PreviewSession } from "../../shared/preview";

type Fields = { lockTitle: boolean; lockArtist: boolean; title: string; artist: string };

export type LyricBridge = {
  pathForFile: (file: File) => string;
  probeUrl: (url: string, fields: Fields) => Promise<ProbeResult>;
  probeFile: (filePath: string, fields: Fields) => Promise<ProbeResult>;
  downloadUrl: (url: string, request: SaveRequest) => Promise<SaveResult>;
  saveFile: (filePath: string, request: SaveRequest) => Promise<SaveResult>;
  createTestClip: () => Promise<PreviewSession>;
  loadProject: (projectPath: string) => Promise<PreviewSession>;
  saveTiming: (projectPath: string, timing: PreviewSession["timing"], look: PreviewSession["look"]) => Promise<boolean>;
  chironFont: () => Promise<ArrayBuffer>;
  exportVideo: (request: {
    projectPath: string;
    mediaPath: string;
    mode: PreviewSession["mode"];
    durationMs: number;
    lines: PreviewSession["lines"];
    timing: PreviewSession["timing"];
    look: PreviewSession["look"];
    title: string;
  }) => Promise<
    { ok: true; outPath: string; assPath: string } | { ok: false; error: string; cancelled?: boolean }
  >;
  onExportProgress: (callback: (text: string) => void) => () => void;
  getSettings: () => Promise<{ showTrans: boolean; traditional: true; romaji: false }>;
  setShowTrans: (showTrans: boolean) => Promise<{ showTrans: boolean }>;
  enqueueUrls: (text: string) => Promise<QueueJob[]>;
  enqueueFile: (filePath: string) => Promise<QueueJob[]>;
  enqueueTest: () => Promise<PreviewSession>;
  openJob: (id: string) => Promise<MatchResult | null>;
  matchProject: (projectPath: string) => Promise<MatchResult | { ok: false; error: string }>;
  browseProject: (
    projectPath: string,
    fields: { title: string; artist: string; lockTitle: boolean; lockArtist: boolean } | null,
  ) => Promise<MatchResult | { ok: false; error: string }>;
  useCandidate: (
    projectPath: string,
    key: string,
    remember: boolean,
  ) => Promise<MatchResult | { ok: false; error: string }>;
  onQueue: (callback: (jobs: QueueJob[]) => void) => () => void;
  onProgress: (callback: (text: string) => void) => () => void;
};

export type QueueJob = {
  id: string;
  label: string;
  status: "waiting" | "running" | "ready" | "failed";
  message: string;
  projectPath?: string;
};

declare global {
  interface Window {
    lyric: LyricBridge;
  }
}
