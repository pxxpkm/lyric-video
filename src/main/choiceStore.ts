import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  choiceGet,
  choiceList,
  choiceRemove,
  choiceRetarget,
  choiceSet,
  type SavedChoice,
} from "../core/title";

export class ChoiceStore {
  private cache: Record<string, string> | null = null;

  constructor(private path: string) {}

  reset(path: string): void {
    this.path = path;
    this.cache = null;
  }

  get(title: string | null | undefined, artist: string | null | undefined): string | null {
    return choiceGet(this.load(), title, artist);
  }

  set(title: string | null | undefined, artist: string | null | undefined, candidateKey: string): void {
    this.cache = choiceSet(this.load(), title, artist, candidateKey);
    this.save();
  }

  removeCandidate(candidateKey: string): boolean {
    const before = this.load();
    const next = choiceRemove(before, candidateKey);
    const removed = Object.keys(next).length !== Object.keys(before).length;
    this.cache = next;
    if (removed) this.save();
    return removed;
  }

  retarget(oldCandidate: string, newCandidate: string): void {
    this.cache = choiceRetarget(this.load(), oldCandidate, newCandidate);
    this.save();
  }

  listAll(): SavedChoice[] {
    return choiceList(this.load());
  }

  private load(): Record<string, string> {
    if (this.cache) return this.cache;
    try {
      if (existsSync(this.path)) {
        this.cache = JSON.parse(readFileSync(this.path, "utf8")) as Record<string, string>;
        return this.cache;
      }
    } catch {
      /* unreadable file is an empty memory */
    }
    this.cache = {};
    return this.cache;
  }

  private save(): void {
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      writeFileSync(this.path, JSON.stringify(this.cache ?? {}, null, 2));
    } catch {
      /* same as DesktopLyric: a failed save keeps the memory copy */
    }
  }
}
