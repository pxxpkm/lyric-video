import { describe, expect, it } from "vitest";
import { lineKey, lyricLine, type LyricLine } from "../../src/core/lyrics";
import { defaultTiming } from "../../src/core/timing";
import { defaultLook, fitPercent, fitUsed, playHeight, playWidth, softBlur } from "../../src/core/lyricLook";
import { setLineFade, setLinePreset, type MotionClip } from "../../src/core/motion";
import { testClipLines } from "../../src/core/preview";
import { drawPreview, hitsCurrentLyric, mediaKeepsPainting } from "../../src/renderer/src/drawPreview";

function alphasAt(lines: LyricLine[], mediaMs: number, clips: MotionClip[] = []): { text: string; alpha: number }[] {
  const host = globalThis as { window?: { devicePixelRatio: number } };
  host.window ??= { devicePixelRatio: 1 };
  host.window.devicePixelRatio = 1;
  const marks: { text: string; alpha: number }[] = [];
  const ctx = {
    font: "16px sans-serif",
    fillStyle: "",
    strokeStyle: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    filter: "none",
    lineJoin: "miter",
    miterLimit: 10,
    lineWidth: 1,
    stack: [] as string[],
    save() {
      this.stack.push(this.font);
    },
    restore() {
      const prev = this.stack.pop();
      if (prev != null) this.font = prev;
    },
    setTransform() {},
    clearRect() {},
    fillRect() {},
    translate() {},
    rotate() {},
    scale() {},
    measureText(text: string) {
      return { width: Array.from(text).length * 10 };
    },
    fillText(text: string) {
      marks.push({ text, alpha: this.globalAlpha });
    },
    strokeText() {},
  };
  const canvas = {
    clientWidth: 1920,
    clientHeight: 1080,
    width: 1920,
    height: 1080,
    getContext: () => ctx,
  };
  drawPreview(canvas as unknown as HTMLCanvasElement, lines, mediaMs, "audio", defaultTiming(), defaultLook, clips);
  return marks;
}

describe("預覽字體", () => {
  it("橫排成句的原文用原文字體，譯文用譯文字體", () => {
    const host = globalThis as { window?: { devicePixelRatio: number } };
    host.window ??= { devicePixelRatio: 1 };
    host.window.devicePixelRatio = 1;
    const paints: { text: string; font: string }[] = [];
    const scales: number[][] = [];
    const ctx = {
      font: "16px sans-serif",
      fillStyle: "",
      strokeStyle: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      globalAlpha: 1,
      filter: "none",
      lineJoin: "miter",
      miterLimit: 10,
      lineWidth: 1,
      stack: [] as string[],
      save() {
        this.stack.push(this.font);
      },
      restore() {
        const prev = this.stack.pop();
        if (prev != null) this.font = prev;
      },
      setTransform() {},
      clearRect() {},
      fillRect() {},
      translate() {},
      rotate() {},
      scale(...args: number[]) {
        scales.push(args);
      },
      measureText(text: string) {
        return { width: Array.from(text).length * 10 };
      },
      fillText(text: string) {
        paints.push({ text, font: this.font });
      },
      strokeText(text: string) {
        paints.push({ text, font: this.font });
      },
    };
    const canvas = {
      clientWidth: 1920,
      clientHeight: 1080,
      width: 1920,
      height: 1080,
      getContext: () => ctx,
    };
    const look = { ...defaultLook, font: "kai", transFont: "jhenghei", size: 64, transSize: 36 };
    drawPreview(canvas as unknown as HTMLCanvasElement, testClipLines(), 4_000, "audio", defaultTiming(), look, []);
    const orig = paints.filter((paint) => paint.text === "第二句");
    const trans = paints.filter((paint) => paint.text === "第二句譯文");
    expect(orig.length).toBeGreaterThan(0);
    expect(trans.length).toBeGreaterThan(0);
    expect(orig.every((paint) => paint.font.startsWith('64px "KaiTi"'))).toBe(true);
    expect(trans.every((paint) => paint.font.startsWith('36px "Microsoft JhengHei"'))).toBe(true);
    expect(scales).toEqual([]);
  });

  it("過長橫排只縮闊度，直排先縮字級", () => {
    const host = globalThis as { window?: { devicePixelRatio: number } };
    host.window ??= { devicePixelRatio: 1 };
    host.window.devicePixelRatio = 1;
    const paints: { text: string; font: string }[] = [];
    const scales: number[][] = [];
    const ctx = {
      font: "16px sans-serif",
      fillStyle: "",
      strokeStyle: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      globalAlpha: 1,
      filter: "none",
      lineJoin: "miter",
      miterLimit: 10,
      lineWidth: 1,
      stack: [] as string[],
      save() {
        this.stack.push(this.font);
      },
      restore() {
        const prev = this.stack.pop();
        if (prev != null) this.font = prev;
      },
      setTransform() {},
      clearRect() {},
      fillRect() {},
      translate() {},
      rotate() {},
      scale(...args: number[]) {
        scales.push(args);
      },
      measureText(text: string) {
        return { width: Array.from(text).length * 10 };
      },
      fillText(text: string) {
        paints.push({ text, font: this.font });
      },
      strokeText(text: string) {
        paints.push({ text, font: this.font });
      },
    };
    const canvas = {
      clientWidth: 1920,
      clientHeight: 1080,
      width: 1920,
      height: 1080,
      getContext: () => ctx,
    };
    const text = "長".repeat(40);
    const percent = fitPercent(text.length, defaultLook.size, defaultLook.tracking, defaultLook.outline, defaultLook.x, playWidth);
    drawPreview(
      canvas as unknown as HTMLCanvasElement,
      [lyricLine(0, text, { translatedText: "短" })],
      500,
      "audio",
      defaultTiming(),
      defaultLook,
      [],
    );
    expect(percent).toBeLessThan(100);
    expect(scales).toEqual([[fitUsed(percent), 1]]);
    expect(paints.filter((paint) => paint.text === text).every((paint) => paint.font.startsWith('64px "Chiron GoRound TC"'))).toBe(true);
    const column = "直".repeat(16);
    paints.length = 0;
    scales.length = 0;
    const upright = { ...defaultLook, flow: "vertical" as const };
    const narrow = fitPercent(column.length, upright.size, upright.tracking, upright.outline, upright.y, playHeight);
    drawPreview(canvas as unknown as HTMLCanvasElement, [lyricLine(0, column)], 500, "audio", defaultTiming(), upright, []);
    const px = upright.size * fitUsed(narrow);
    expect(narrow).toBeLessThan(100);
    expect(scales).toEqual([]);
    expect(paints.length).toBeGreaterThan(0);
    expect(paints.every((paint) => paint.font.startsWith(`${px}px "Chiron GoRound TC"`))).toBe(true);
  });

  it("句頭句尾先淡，空白畫面保持實色", () => {
    const lines = testClipLines();
    const head = alphasAt(lines, 1_000).filter((mark) => mark.text === "第一句");
    const mid = alphasAt(lines, 2_000).filter((mark) => mark.text === "第一句");
    const tail = alphasAt(lines, 2_975).filter((mark) => mark.text === "第一句");
    expect(head.length).toBeGreaterThan(0);
    expect(head.every((mark) => mark.alpha === 0)).toBe(true);
    expect(mid.every((mark) => mark.alpha === 1)).toBe(true);
    expect(tail.every((mark) => mark.alpha === 0.5)).toBe(true);
    const transHead = alphasAt(lines, 3_000);
    expect(transHead.filter((mark) => mark.text === "第二句").every((mark) => mark.alpha === 0)).toBe(true);
    expect(transHead.filter((mark) => mark.text === "第二句譯文").every((mark) => mark.alpha === 0)).toBe(true);
    const transMid = alphasAt(lines, 4_500);
    expect(transMid.filter((mark) => mark.text === "第二句譯文").every((mark) => mark.alpha === 1)).toBe(true);
    const empty = alphasAt([], 1_000);
    expect(empty.filter((mark) => mark.text === "尚未有歌詞").every((mark) => mark.alpha === 1)).toBe(true);
    const key = lineKey(lines[0]);
    const cut = setLineFade(setLineFade([], key, "第一句", 1_000, 3_000, "in", 0), key, "第一句", 1_000, 3_000, "out", 0);
    expect(alphasAt(lines, 1_000, cut).filter((mark) => mark.text === "第一句").every((mark) => mark.alpha === 1)).toBe(true);
  });

  it("柔邊程度同匯出同一個數，空白畫面唔模糊", () => {
    const host = globalThis as { window?: { devicePixelRatio: number } };
    host.window ??= { devicePixelRatio: 1 };
    host.window.devicePixelRatio = 1;
    const marks: { text: string; filter: string }[] = [];
    const ctx = {
      font: "16px sans-serif",
      fillStyle: "",
      strokeStyle: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      globalAlpha: 1,
      filter: "none",
      lineJoin: "miter",
      miterLimit: 10,
      lineWidth: 1,
      stack: [] as string[],
      save() {
        this.stack.push(this.font);
      },
      restore() {
        const prev = this.stack.pop();
        if (prev != null) this.font = prev;
        this.filter = "none";
      },
      setTransform() {},
      clearRect() {},
      fillRect() {},
      translate() {},
      rotate() {},
      scale() {},
      measureText(text: string) {
        return { width: Array.from(text).length * 10 };
      },
      fillText(text: string) {
        marks.push({ text, filter: this.filter });
      },
      strokeText() {},
    };
    const canvas = {
      clientWidth: 1920,
      clientHeight: 1080,
      width: 1920,
      height: 1080,
      getContext: () => ctx,
    };
    drawPreview(
      canvas as unknown as HTMLCanvasElement,
      testClipLines(),
      4_000,
      "audio",
      defaultTiming(),
      { ...defaultLook, softBlur: 2 },
      [],
    );
    expect(marks.filter((mark) => mark.text === "第二句").every((mark) => mark.filter === "blur(2px)")).toBe(true);
    expect(marks.filter((mark) => mark.text === "第二句譯文").every((mark) => mark.filter === "blur(2px)")).toBe(true);
    marks.length = 0;
    drawPreview(canvas as unknown as HTMLCanvasElement, [], 1_000, "audio", defaultTiming(), { ...defaultLook, softBlur: softBlur }, []);
    expect(marks.filter((mark) => mark.text === "尚未有歌詞").every((mark) => mark.filter === "none")).toBe(true);
  });
});

describe("預覽拖曳抓字", () => {
  function hitAt(
    lines: LyricLine[],
    mediaMs: number,
    point: { x: number; y: number },
    look = defaultLook,
    clips: MotionClip[] = [],
  ) {
    const ctx = {
      font: "16px sans-serif",
      save() {},
      restore() {},
      measureText(text: string) {
        return { width: Array.from(text).length * 10 };
      },
    };
    const canvas = {
      clientWidth: 1920,
      clientHeight: 1080,
      getContext: () => ctx,
    };
    return hitsCurrentLyric(
      canvas as unknown as HTMLCanvasElement,
      lines,
      mediaMs,
      defaultTiming(),
      look,
      clips,
      point,
    );
  }

  it("飛入開頭抓到而家的字，亦抓到句尾定位", () => {
    const line = testClipLines()[0];
    const clips = setLinePreset([], lineKey(line), line.text, 1_000, 3_000, "fly");
    const restY = defaultLook.y * 1080;
    expect(hitAt(testClipLines(), 1_000, { x: 960, y: restY + 72 }, defaultLook, clips)).toBe("orig");
    expect(hitAt(testClipLines(), 1_000, { x: 960, y: restY }, defaultLook, clips)).toBe("orig");
    expect(hitAt(testClipLines(), 1_000, { x: 10, y: 10 }, defaultLook, clips)).toBeNull();
  });

  it("直排飛入抓到移低咗的字柱", () => {
    const line = testClipLines()[0];
    const clips = setLinePreset([], lineKey(line), line.text, 1_000, 3_000, "fly");
    const look = { ...defaultLook, flow: "vertical" as const };
    const restY = look.y * 1080;
    expect(hitAt([line], 1_000, { x: 960, y: restY + 72 + 90 }, look, clips)).toBe("orig");
  });

  it("原文同譯文重疊時，抓到畫在上面的譯文", () => {
    const look = { ...defaultLook, transX: defaultLook.x, transY: defaultLook.y };
    const y = look.y * 1080;
    expect(hitAt(testClipLines(), 4_000, { x: 960, y }, look)).toBe("trans");
    expect(hitAt(testClipLines(), 4_000, { x: 960, y: y + 30 }, look)).toBe("orig");
  });
});

describe("預覽暫停就停畫", () => {
  it("暫停同播完唔再連續畫，播緊先至畫", () => {
    expect(mediaKeepsPainting(null)).toBe(false);
    expect(mediaKeepsPainting({ paused: true, ended: false })).toBe(false);
    expect(mediaKeepsPainting({ paused: true, ended: true })).toBe(false);
    expect(mediaKeepsPainting({ paused: false, ended: false })).toBe(true);
    expect(mediaKeepsPainting({ paused: false, ended: true })).toBe(false);
  });
});
