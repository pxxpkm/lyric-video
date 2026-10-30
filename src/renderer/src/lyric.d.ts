import type { ProbeResult, SaveRequest, SaveResult } from "../../shared/import";
import type { MatchResult } from "../../shared/pick";
import type { PreviewSession } from "../../shared/preview";

type Fields = { lockTitle: boolean; lockArtist: boolean; title: string; artist: string };

export type LyricBridge = {
  cookieStatus: () => Promise<import("../../core/cookies").CookieStatus>;
  selectCookies: () => Promise<{ ok: true; status: import("../../core/cookies").CookieStatus } | { ok: false; error?: string; cancelled?: boolean }>;
  clearCookies: () => Promise<{ ok: true; status: import("../../core/cookies").CookieStatus } | { ok: false; error?: string; cancelled?: boolean }>;
  cancelTool: (kind: "import" | "export") => Promise<boolean>;
  onToolState: (callback: (state: { kind: "import" | "export"; active: boolean }) => void) => () => void;
  cancelQueueJob: (id: string) => Promise<QueueJob[]>;
  retryQueueJob: (id: string) => Promise<QueueJob[]>;
  findSourceProjects: (source: import("../../shared/import").ImportSource) => Promise<import("../../shared/import").SavedSourceProject[]>;
  onCloseRequest: (callback: () => Promise<boolean>) => () => void;
  listCache: () => Promise<import("../../shared/cache").CacheEntry[]>;
  trashCache: (path: string) => Promise<string>;
  trashAllCache: () => Promise<string>;
  pathForFile: (file: File) => string;
  probeUrl: (url: string, fields: Fields) => Promise<ProbeResult>;
  probeFile: (filePath: string, fields: Fields) => Promise<ProbeResult>;
  downloadUrl: (url: string, request: SaveRequest) => Promise<SaveResult>;
  saveFile: (filePath: string, request: SaveRequest) => Promise<SaveResult>;
  createTestClip: () => Promise<PreviewSession>;
  loadProject: (projectPath: string) => Promise<PreviewSession>;
  resumeProject: (projectPath: string) => Promise<MatchResult | { ok: false; error: string }>;
  saveTiming: (
    projectPath: string,
    timing: PreviewSession["timing"],
    look: PreviewSession["look"],
    motion: PreviewSession["motion"],
  ) => Promise<boolean>;
  chironFont: () => Promise<ArrayBuffer>;
  exportVideo: (request: {
    textMeasurements?: import("../../core/textWidth").TextMeasurement[];
    projectPath: string;
    mediaPath: string;
    mode: PreviewSession["mode"];
    durationMs: number;
    lines: PreviewSession["lines"];
    timing: PreviewSession["timing"];
    look: PreviewSession["look"];
    motion: PreviewSession["motion"];
    title: string;
  }) => Promise<
    { ok: true; outPath: string; assPath: string } | { ok: false; error: string; cancelled?: boolean }
  >;
  exportAss: (request: {
    textMeasurements?: import("../../core/textWidth").TextMeasurement[];
    projectPath: string;
    mediaPath: string;
    mode: PreviewSession["mode"];
    durationMs: number;
    lines: PreviewSession["lines"];
    timing: PreviewSession["timing"];
    look: PreviewSession["look"];
    motion: PreviewSession["motion"];
    title: string;
  }) => Promise<{ ok: true; outPath: string } | { ok: false; error: string; cancelled?: boolean }>;
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
  status: "waiting" | "running" | "ready" | "failed" | "cancelled";
  message: string;
  projectPath?: string;
};

declare global {
  interface Window {
    lyric: LyricBridge;
  }
}
