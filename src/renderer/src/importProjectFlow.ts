import type { SaveRequest, SaveResult } from "../../shared/import";
import type { MatchResult } from "../../shared/pick";

export type ImportSource = { kind: "youtube"; url: string } | { kind: "file"; path: string };
type Result = MatchResult | { ok: false; error: string };
type ImportApi = {
  downloadUrl: (url: string, request: SaveRequest) => Promise<SaveResult>;
  saveFile: (path: string, request: SaveRequest) => Promise<SaveResult>;
  matchProject: (path: string) => Promise<Result>;
  resumeProject: (path: string) => Promise<MatchResult>;
};

export class ImportProjectFlow {
  private created: { key: string; path: string } | null = null;
  private running: Promise<Result> | null = null;
  private generation = 0;

  reset() { this.created = null; this.generation++; }
  get hasCreated() { return this.created !== null; }
  existingPath(source: ImportSource, request: SaveRequest): string | null {
    return this.created?.key === JSON.stringify([source, request]) ? this.created.path : null;
  }

  open(source: ImportSource, request: SaveRequest, api: ImportApi): Promise<Result> {
    if (this.running) return this.running;
    const generation = this.generation;
    const key = JSON.stringify([source, request]);
    const existing = this.existingPath(source, request);
    this.running = (async () => {
      if (existing) return api.resumeProject(existing);
      const result = source.kind === "youtube" ? await api.downloadUrl(source.url, request) : await api.saveFile(source.path, request);
      if (!result.ok) return result;
      // 即使後續搜詞失敗，重試亦回到這份專案，不能悄悄另建初始設定的副本。
      if (generation === this.generation) this.created = { key, path: result.projectPath };
      return api.matchProject(result.projectPath);
    })().finally(() => { this.running = null; });
    return this.running;
  }
}
