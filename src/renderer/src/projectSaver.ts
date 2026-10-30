export type SaveStatus = "saved" | "pending" | "saving" | "error";

export class ProjectSaver<T> {
  private saved: string;
  private desired: string;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<boolean> | null = null;
  private listeners = new Set<(status: SaveStatus) => void>();
  status: SaveStatus = "saved";

  constructor(initial: T, private readonly write: (value: T) => Promise<void>, private readonly delay = 200) {
    this.saved = this.desired = JSON.stringify(initial);
  }

  subscribe(listener: (status: SaveStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => { this.listeners.delete(listener); };
  }

  private notify(status: SaveStatus) {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }

  update(value: T) {
    const encoded = JSON.stringify(value);
    if (encoded === this.desired) return;
    this.desired = encoded;
    clearTimeout(this.timer);
    if (!this.running && this.desired === this.saved) { this.notify("saved"); return; }
    this.notify(this.running ? "saving" : "pending");
    this.timer = setTimeout(() => { void this.flush(); }, this.delay);
  }

  flush(): Promise<boolean> {
    clearTimeout(this.timer);
    if (this.running) return this.running;
    if (this.desired === this.saved) { this.notify("saved"); return Promise.resolve(true); }
    this.running = this.drain().finally(() => { this.running = null; });
    return this.running;
  }

  private async drain(): Promise<boolean> {
    this.notify("saving");
    try {
      while (this.desired !== this.saved) {
        const snapshot = this.desired;
        await this.write(JSON.parse(snapshot));
        this.saved = snapshot;
      }
      this.notify("saved");
      return true;
    } catch {
      this.notify("error");
      return false;
    }
  }
}

let active: (() => Promise<boolean>) | null = null;
export function registerActiveSave(save: () => Promise<boolean>): () => void {
  active = save;
  return () => { if (active === save) active = null; };
}
export async function flushActiveSave(): Promise<boolean> {
  return active ? active() : true;
}
