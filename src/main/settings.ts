import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logDir } from "./log";

export type Settings = {
  showTrans: boolean;
  traditional: true;
  romaji: false;
};

const defaults: Settings = { showTrans: true, traditional: true, romaji: false };

export function readSettings(): Settings {
  try {
    const raw = JSON.parse(readFileSync(join(logDir(), "settings.json"), "utf8")) as Partial<Settings>;
    return { ...defaults, showTrans: raw.showTrans !== false, traditional: true, romaji: false };
  } catch {
    return { ...defaults };
  }
}

export function writeSettings(next: { showTrans: boolean }): Settings {
  const settings: Settings = { showTrans: next.showTrans, traditional: true, romaji: false };
  const dir = logDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "settings.json"), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return settings;
}
