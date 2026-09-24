export function hasKana(text: string | null | undefined): boolean {
  if (!text) return false;
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

export function isJapaneseLine(text: string | null | undefined, lineHint?: string | null): boolean {
  return hasKana(text) || hasKana(lineHint);
}

function isSkipped(c: string): boolean {
  return /\s/u.test(c) || /\p{P}/u.test(c);
}

export function looksLikeChinese(text: string): boolean {
  let cjk = 0;
  let total = 0;
  for (const c of text) {
    if (isSkipped(c)) continue;
    total++;
    const code = c.codePointAt(0) ?? 0;
    if (code >= 0x4e00 && code <= 0x9fff) cjk++;
  }
  return total > 0 && cjk / total > 0.3;
}

export function isChineseOnly(text: string | null | undefined): boolean {
  return !!text && text.trim().length > 0 && looksLikeChinese(text) && !hasKana(text);
}

export function isKana(c: string): boolean {
  if (!c) return false;
  const code = c.charCodeAt(0);
  return (
    (code >= 0x3040 && code <= 0x309f) ||
    (code >= 0x30a0 && code <= 0x30ff) ||
    (code >= 0x31f0 && code <= 0x31ff) ||
    (code >= 0xff66 && code <= 0xff9d)
  );
}
