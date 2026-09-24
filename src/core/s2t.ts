type Table = {
  map: Map<string, string>;
  maxLen: number;
  starters: Set<string>;
};

let stTable: Table = emptyTable();
let hkTable: Table = emptyTable();
let ready = false;

function emptyTable(): Table {
  return { map: new Map(), maxLen: 1, starters: new Set() };
}

function hasKana(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (
      (c >= 0x3040 && c <= 0x309f) ||
      (c >= 0x30a0 && c <= 0x30ff) ||
      (c >= 0x31f0 && c <= 0x31ff) ||
      (c >= 0xff66 && c <= 0xff9d)
    ) {
      return true;
    }
  }
  return false;
}

function loadTable(parts: string[]): Table {
  const map = new Map<string, string>();
  let maxLen = 1;
  for (const part of parts) {
    for (let line of part.split(/\r?\n/)) {
      if (line.charCodeAt(0) === 0xfeff) line = line.slice(1);
      if (line.length === 0 || line[0] === "#") continue;
      const tab = line.indexOf("\t");
      if (tab <= 0) continue;
      const key = line.slice(0, tab);
      const rest = line.slice(tab + 1);
      const space = rest.indexOf(" ");
      const value = space < 0 ? rest : rest.slice(0, space);
      if (!key || !value) continue;
      map.set(key, value);
      if (key.length > maxLen) maxLen = key.length;
    }
  }
  const starters = new Set<string>();
  for (const key of map.keys()) starters.add(key[0]);
  return { map, maxLen, starters };
}

function apply(input: string, table: Table): string {
  let out = "";
  for (let i = 0; i < input.length; ) {
    if (!table.starters.has(input[i])) {
      out += input[i];
      i++;
      continue;
    }
    const max = Math.min(table.maxLen, input.length - i);
    let mapped: string | undefined;
    let take = 1;
    for (let len = max; len >= 1; len--) {
      const hit = table.map.get(input.slice(i, i + len));
      if (hit !== undefined) {
        mapped = hit;
        take = len;
        break;
      }
    }
    out += mapped ?? input[i];
    i += take;
  }
  return out;
}

/** 字典文字由呼叫端讀入。沒有 Windows LCMap 後備。 */
export function installDict(stCharacters: string, stPhrases: string, hkVariants: string): void {
  stTable = loadTable([stCharacters, stPhrases]);
  hkTable = loadTable([hkVariants]);
  ready = true;
}

export function dictReady(): boolean {
  return ready;
}

export function convert(input: string | null | undefined): string | null | undefined {
  if (input == null || input === "") return input;
  if (hasKana(input)) return input;
  if (stTable.map.size === 0) return input;
  const trad = apply(input, stTable);
  return hkTable.map.size === 0 ? trad : apply(trad, hkTable);
}
