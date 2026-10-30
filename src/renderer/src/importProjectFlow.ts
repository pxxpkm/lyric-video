import type { SaveRequest, SaveResult, ImportSource, SavedSourceProject } from "../../shared/import";
import type { MatchResult } from "../../shared/pick";

export type { ImportSource } from "../../shared/import";
type Result = MatchResult | { ok: false; error: string } | { kind: "existing-projects"; projects: SavedSourceProject[] };
type ImportApi = {
  downloadUrl: (url: string, request: SaveRequest) => Promise<SaveResult>;
  saveFile: (path: string, request: SaveRequest) => Promise<SaveResult>;
  matchProject: (path: string) => Promise<MatchResult | { ok: false; error: string }>;
  resumeProject: (path: string) => Promise<MatchResult | { ok: false; error: string }>;
  findSourceProjects: (source: ImportSource) => Promise<SavedSourceProject[]>;
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

  continueWith(source: ImportSource, request: SaveRequest, path: string, api: ImportApi): Promise<Result> {
    if (this.running) return this.running;
    this.created = { key: JSON.stringify([source, request]), path };
    return this.open(source, request, api);
  }

  open(source: ImportSource, request: SaveRequest, api: ImportApi, createNew = false): Promise<Result> {
    if (this.running) return this.running;
    const generation = this.generation;
    const key = JSON.stringify([source, request]);
    const existing = createNew ? null : this.existingPath(source, request);
    this.running = (async () => {
      if (existing) return api.resumeProject(existing);
      if (!createNew) {
        const projects = await api.findSourceProjects(source);
        if (projects.length) return { kind: "existing-projects" as const, projects };
      }
      const result = source.kind === "youtube" ? await api.downloadUrl(source.url, request) : await api.saveFile(source.path, request);
      if (!result.ok) return result;
      // 即使後續搜詞失敗，重試亦回到這份專案，不能悄悄另建初始設定的副本。
      if (generation === this.generation) this.created = { key, path: result.projectPath };
      return api.matchProject(result.projectPath);
    })().finally(() => { this.running = null; });
    return this.running;
  }
}
