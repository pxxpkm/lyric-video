import type { ProbeResult, SaveRequest, SaveResult } from "../../shared/import";
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
  saveTiming: (projectPath: string, timing: PreviewSession["timing"]) => Promise<boolean>;
  onProgress: (callback: (text: string) => void) => () => void;
};

declare global {
  interface Window {
    lyric: LyricBridge;
  }
}
