import { describe, expect, it } from "vitest";
import { buildKaraokeAss, karaokeCentiseconds } from "../../src/core/ass";
import { lyricLine } from "../../src/core/lyrics";
import { assColor, assFontSize, defaultLook, edgeOutlineAt, fitPercent, fitUsed, playHeight, playWidth, softBlur } from "../../src/core/lyricLook";
import { decorDots, decorFadeTag, decorLayout, decorMoveWindow, setLineFade, setLinePreset, type MotionClip } from "../../src/core/motion";
import { testClipLines } from "../../src/core/preview";
import { exampleProject, parseProject } from "../../src/core/project";
import { defaultTiming } from "../../src/core/timing";

describe("karaoke.ass", () => {
  it("有逐字的句子，\\k 總長等於句長", () => {
    const line = testClipLines()[2];
    const parts = karaokeCentiseconds(line, 1);
    const sung = line.words?.reduce((sum, word) => sum + word.durMs, 0) ?? 0;
    expect(Math.abs(parts.reduce((sum, cs) => sum + cs, 0) - Math.round(sung / 10))).toBeLessThanOrEqual(1);
    const ass = buildKaraokeAss(testClipLines());
    const dialogue = ass.split("\n").find((row) => row.includes("{\\k"));
    expect(dialogue).toBeTruthy();
    const burned = [...(dialogue ?? "").matchAll(/\\k(\d+)/g)].map((match) => Number(match[1]));
    expect(Math.abs(burned.reduce((sum, cs) => sum + cs, 0) - 120)).toBeLessThanOrEqual(1);
  });

  it("沒有逐字就不寫 \\k，譯文在第二行", () => {
    const ass = buildKaraokeAss(testClipLines());
    const first = ass.split("\n").find((row) => row.includes("第一句"));
    expect(first).toBeTruthy();
    expect(first).not.toContain("\\k");
    expect(ass).toContain("第二句譯文");
  });

  it("垂直逐字由上寫到下，中文用自己的位置", () => {
    const look = { ...defaultLook, flow: "vertical" as const, size: 40, transX: 0.8, transY: 0.82 };
    const ass = buildKaraokeAss(testClipLines(), undefined, look);
    expect(ass).not.toContain("\\frz");
    expect(ass).toContain("\\pos(960,846)");
    expect(ass).toContain("\\pos(960,886)");
    expect(ass).toContain("\\pos(960,926)");
    expect(ass).toContain("\\pos(1536,886)");
    expect(ass).toContain("\\t(400,400,\\1c");
    const upright = ass.split("\n").filter((row) => row.includes("第一") || row.includes("句"));
    expect(upright.some((row) => row.endsWith("第一句}"))).toBe(false);
    const legacy = buildKaraokeAss(testClipLines(), undefined, { ...look, flow: "left" as "vertical" });
    expect(legacy).toContain("\\pos(960,846)");
    expect(legacy).not.toContain("\\pos(192,");
  });

  it("譯文有自己的字級同顏色", () => {
    const look = {
      ...defaultLook,
      size: 40,
      color: "#111111",
      sungColor: "#222222",
      transSize: 80,
      transColor: "#ABCDEF",
    };
    const ass = buildKaraokeAss(testClipLines(), undefined, look);
    const orig = ass.split("\n").find((row) => row.startsWith("Style: Orig"));
    const trans = ass.split("\n").find((row) => row.startsWith("Style: Trans"));
    expect(orig).toContain(String(assFontSize(40, "chiron")));
    expect(orig).toContain(assColor("#111111"));
    expect(trans).toContain(String(assFontSize(80, "chiron")));
    expect(trans).toContain(assColor("#ABCDEF"));
    expect(trans).not.toContain(assColor("#111111"));
    const vertical = buildKaraokeAss(testClipLines(), undefined, { ...look, flow: "vertical" });
    const glyph = vertical.split("\n").find((row) => row.endsWith("譯"));
    const transFit = fitPercent(Array.from("第二句譯文").length, 80, look.tracking, look.outline, look.transY, playHeight);
    expect(transFit).toBeLessThan(100);
    expect(glyph).toContain(`\\fs${assFontSize(80 * fitUsed(transFit), "chiron")}`);
    expect(glyph).toContain(`\\1c${assColor("#ABCDEF")}`);
    const main = vertical.split("\n").find((row) => row.endsWith("第"));
    expect(main).toContain(`\\fs${assFontSize(40, "chiron")}`);
    expect(main).toContain(`\\1c${assColor("#111111")}`);
  });

  it("橫排的譯文用自己的位置", () => {
    const look = { ...defaultLook, x: 0.25, y: 0.8, transX: 0.75, transY: 0.3, size: 40 };
    const ass = buildKaraokeAss(testClipLines(), undefined, look);
    expect(ass).toContain("\\pos(480,864)");
    expect(ass).toContain("\\pos(1440,324)");
  });

  it("飛入寫 \\move，終點係定位，直排字距不變", () => {
    const clip = presetClip("1000|第一句", "第一句", 1000, 3000, "fly");
    const row = buildKaraokeAss(testClipLines(), undefined, defaultLook, [clip])
      .split("\n")
      .find((line) => line.includes("第一句"));
    expect(row).toContain("\\move");
    expect(row).not.toContain("\\pos");
    const move = row?.match(/\\move\((\d+),(\d+),(\d+),(\d+),0,350\)/);
    expect(move).toBeTruthy();
    expect(Number(move?.[2])).toBe(Number(move?.[4]) + 72);
    const look = { ...defaultLook, flow: "vertical" as const, size: 40 };
    const moves = buildKaraokeAss(testClipLines(), undefined, look, [clip])
      .split("\n")
      .filter((line) => line.includes("\\move"))
      .map((line) => line.match(/\\move\((\d+),(\d+),(\d+),(\d+),0,(\d+)\)/));
    expect(moves).toHaveLength(3);
    expect(moves.map((match) => Number(match?.[4]))).toEqual([846, 886, 926]);
    expect(moves.map((match) => Number(match?.[2]))).toEqual([918, 958, 998]);
    expect(moves.every((match) => match?.[1] === "960" && match?.[3] === "960" && match?.[5] === "350")).toBe(true);
    expect(Number(moves[1]?.[4]) - Number(moves[0]?.[4])).toBe(40);
    expect(Number(moves[1]?.[2]) - Number(moves[0]?.[2])).toBe(40);
  });

  it("放大同擺正寫縮放同角度，只有淡入唔寫 \\move", () => {
    const scale = presetClip("3000|第二句", "第二句", 3000, 6000, "scale");
    const scaled = buildKaraokeAss(testClipLines(), undefined, defaultLook, [scale]);
    const orig = scaled.split("\n").find((line) => line.includes("第二句") && !line.includes("譯文"));
    const trans = scaled.split("\n").find((line) => line.includes("第二句譯文"));
    expect(orig).toContain("\\fscx82\\fscy82\\t(0,300,\\fscx100\\fscy100)");
    expect(trans).toContain("\\fscx82\\fscy82\\t(0,300,\\fscx100\\fscy100)");
    expect(scaled).not.toContain("\\move");
    const turned = buildKaraokeAss(testClipLines(), undefined, { ...defaultLook, flow: "vertical", size: 40 }, [
      presetClip("1000|第一句", "第一句", 1000, 3000, "turn"),
    ]);
    const glyphs = turned.split("\n").filter((line) => line.includes("\\frz-6\\t(0,300,\\frz0)"));
    expect(glyphs).toHaveLength(3);
    expect(glyphs.every((line) => line.includes("\\pos(") && !line.includes("\\move"))).toBe(true);
    expect(glyphs.map((line) => line.match(/\\pos\(\d+,(\d+)\)/)?.[1])).toEqual(["846", "886", "926"]);
    const faded = setLineFade([], "1000|第一句", "第一句", 1000, 3000, "in", 400);
    const fadeOnly = buildKaraokeAss(testClipLines(), undefined, defaultLook, faded);
    const fadedOrig = fadeOnly.split("\n").find((line) => line.includes("第一句") && line.includes(",Orig,"));
    expect(fadedOrig).toContain("\\fad(400,50)");
    expect(fadedOrig).not.toContain("\\fade");
    expect(fadeOnly).not.toContain("\\move");
  });

  it("有逐字嘅原文揀變色仍然保留 \\k，譯文成句變色", () => {
    const line = lyricLine(1_000, "甲乙", {
      translatedText: "丙",
      words: [
        { startMs: 0, durMs: 500, text: "甲" },
        { startMs: 500, durMs: 500, text: "乙" },
      ],
    });
    const look = { ...defaultLook, color: "#111111", sungColor: "#222222", transColor: "#ABCDEF" };
    const clip = presetClip("1000|甲乙", "甲乙", 1000, 15_500, "tint");
    const ass = buildKaraokeAss([line], undefined, look, [clip]);
    const orig = ass.split("\n").find((row) => row.includes("\\k"));
    expect(orig).toBeTruthy();
    expect(orig).not.toContain("\\t(0,");
    const trans = ass.split("\n").find((row) => row.includes("丙"));
    expect(trans).toContain(`\\1c${assColor("#ABCDEF")}`);
    expect(trans).toContain("\\t(0,5800,\\1c");
    expect(trans).toContain(assColor("#222222"));
    expect(trans).not.toContain(assColor("#111111"));
    const vertical = buildKaraokeAss([line], undefined, { ...look, flow: "vertical" }, [clip]);
    const sung = vertical.split("\n").filter((row) => row.endsWith("甲") || row.endsWith("乙"));
    expect(sung.every((row) => row.includes("\\t(") && !row.includes("\\t(0,"))).toBe(true);
    const translated = vertical.split("\n").find((row) => row.endsWith("丙"));
    expect(translated).toContain("\\t(0,5800,\\1c");
    expect(translated).toContain(assColor("#ABCDEF"));
  });

  it("舊檔冇預設，重開唔會寫 \\move", () => {
    const raw = exampleProject();
    const parsed = parseProject({
      ...raw,
      lyrics: raw.lyrics,
      motion: [
        {
          id: "a",
          text: "第一句",
          startMs: 1000,
          endMs: 3000,
          lineKey: "1000|第一句",
          enter: { x: 0.2, y: 0.7, opacity: 0 },
          leave: { x: 0.2, y: 0.7, opacity: 1 },
        },
      ],
    });
    expect(parsed.motion[0].preset).toBeUndefined();
    expect(parsed.motion[0].fadeInMs).toBeUndefined();
    const ass = buildKaraokeAss(testClipLines(), undefined, defaultLook, parsed.motion);
    const row = ass.split("\n").find((line) => line.startsWith("Dialogue: 0,0:00:01.00,") && line.includes(",Orig,"));
    expect(row).toContain("\\fad(50,50)");
    expect(row).not.toContain("\\fade");
    expect(row).toContain("\\pos(");
    expect(ass).not.toContain("\\move");
  });

  it("微塵沿成句，小點細而且錯開，歌詞仍然停住", () => {
    const clip = presetClip("1000|第一句", "第一句", 1000, 3000, "dust");
    const ass = buildKaraokeAss(testClipLines(), undefined, defaultLook, [clip]);
    const lyric = ass.split("\n").find((row) => row.includes("第一句"));
    expect(lyric).toContain("\\pos(");
    expect(lyric).not.toContain("\\move");
    expect(lyric).not.toContain("●");
    const dots = ass.split("\n").filter((row) => row.includes("●"));
    const placed = decorDots("dust", 2000, decorLayout("第一句", defaultLook.size, false));
    const move = decorMoveWindow(placed[0], 2000);
    expect(dots).toHaveLength(placed.length);
    expect(dots[0]).toContain(`\\move(${960 + placed[0].x},${886 + placed[0].y},${960 + placed[0].x2},${886 + placed[0].y2},${move.t1},${move.t2})`);
    expect(placed[0].x).toBe(-96);
    expect(placed[placed.length - 1].x).toBe(96);
    expect(placed[0].size).toBeLessThanOrEqual(14);
    expect(dots[0]).toContain(`\\fs${assFontSize(placed[0].size, "chiron")}`);
    expect(dots[0]).toContain("\\bord0");
    expect(dots[0]).toContain(decorFadeTag(placed[0], 2000));
    expect(decorFadeTag(placed[0], 2000).startsWith("\\fade(255,")).toBe(true);
    expect(placed.some((dot) => dot.delayMs > 0)).toBe(true);
    expect(dots.every((row) => !row.includes("\\k"))).toBe(true);
    const vertical = buildKaraokeAss(testClipLines(), undefined, { ...defaultLook, flow: "vertical", size: 40 }, [clip]);
    const upright = decorDots("dust", 2000, decorLayout("第一句", 40, true));
    expect(vertical).toContain("\\pos(960,846)");
    expect(vertical).toContain("\\pos(960,886)");
    expect(vertical).toContain("\\pos(960,926)");
    expect(vertical.split("\n").filter((row) => row.includes("●"))).toHaveLength(upright.length);
    const both = buildKaraokeAss(testClipLines(), undefined, { ...defaultLook, transColor: "#ABCDEF" }, [
      presetClip("3000|第二句", "第二句", 3000, 6000, "dust"),
    ]);
    const paired = both.split("\n").filter((row) => row.includes("●"));
    const orig = decorDots("dust", 3000, decorLayout("第二句", defaultLook.size, false));
    const trans = decorDots("dust", 3000, decorLayout("第二句譯文", defaultLook.transSize, false));
    expect(paired).toHaveLength(orig.length + trans.length);
    expect(paired.some((row) => row.includes(assColor("#ABCDEF")))).toBe(true);
  });

  it("光斑同弧線都係細點，終點跟表", () => {
    const glow = buildKaraokeAss(testClipLines(), undefined, defaultLook, [
      presetClip("1000|第一句", "第一句", 1000, 3000, "glow"),
    ]);
    const glowDots = glow.split("\n").filter((row) => row.includes("●"));
    const glowPlaced = decorDots("glow", 2000, decorLayout("第一句", defaultLook.size, false));
    const glowMove = decorMoveWindow(glowPlaced[0], 2000);
    expect(glowDots).toHaveLength(glowPlaced.length);
    expect(glowDots[0]).toContain(
      `\\move(${960 + glowPlaced[0].x},${886 + glowPlaced[0].y},${960 + glowPlaced[0].x2},${886 + glowPlaced[0].y2},${glowMove.t1},${glowMove.t2})`,
    );
    expect(glowPlaced[0].x).toBe(-96);
    expect(glowPlaced[glowPlaced.length - 1].x).toBe(96);
    expect(glowPlaced[0].size).toBeLessThanOrEqual(26);
    expect(glowDots[0]).toContain(`\\fs${assFontSize(glowPlaced[0].size, "chiron")}`);
    expect(glowDots[0]).toContain(decorFadeTag(glowPlaced[0], 2000));
    expect(glow).not.toContain("\\blur");
    const arc = buildKaraokeAss(testClipLines(), undefined, defaultLook, [
      presetClip("1000|第一句", "第一句", 1000, 3000, "arc"),
    ]);
    const arcDots = arc.split("\n").filter((row) => row.includes("●"));
    const arcPlaced = decorDots("arc", 2000, decorLayout("第一句", defaultLook.size, false));
    const firstMove = decorMoveWindow(arcPlaced[0], 2000);
    const last = arcPlaced[arcPlaced.length - 1];
    const lastMove = decorMoveWindow(last, 2000);
    expect(arcDots).toHaveLength(arcPlaced.length);
    expect(arcDots[0]).toContain(
      `\\move(${960 + arcPlaced[0].x},${886 + arcPlaced[0].y},${960 + arcPlaced[0].x2},${886 + arcPlaced[0].y2},${firstMove.t1},${firstMove.t2})`,
    );
    expect(arcDots[arcDots.length - 1]).toContain(
      `\\move(${960 + last.x},${886 + last.y},${960 + last.x2},${886 + last.y2},${lastMove.t1},${lastMove.t2})`,
    );
    expect(arcPlaced[0].x).toBe(-96);
    expect(last.x2).toBe(96);
    const lyric = arc.split("\n").find((row) => row.includes("第一句"));
    expect(lyric).toContain("\\pos(");
    expect(lyric).not.toContain("\\move");
  });

  it("漸邊由裙邊色漸到唱到色，歌詞仍然停住", () => {
    const colors = (count: number) =>
      Array.from({ length: count }, (_, index) => assColor(edgeOutlineAt(defaultLook.outlineColor, defaultLook.sungColor, index, count)));
    const tags = (row: string | undefined) => [...(row ?? "").matchAll(/\\3c(&H[0-9A-F]+&)/gi)].map((match) => match[1].toUpperCase());
    const clip = presetClip("1000|第一句", "第一句", 1000, 3000, "edge");
    const ass = buildKaraokeAss(testClipLines(), undefined, defaultLook, [clip]);
    const lyric = ass.split("\n").find((row) => row.includes("0:00:01.00") && row.includes("第") && !row.includes("二"));
    expect(lyric).toContain("\\pos(");
    expect(lyric).not.toContain("\\move");
    expect(lyric).not.toContain("●");
    expect(tags(lyric)).toEqual(colors(3));
    expect(new Set(tags(lyric)).size).toBe(3);
    const plain = buildKaraokeAss(testClipLines()).split("\n").find((row) => row.includes("第一句"));
    expect(tags(plain)).toEqual([assColor(defaultLook.outlineColor)]);
    const vertical = buildKaraokeAss(testClipLines(), undefined, { ...defaultLook, flow: "vertical", size: 40 }, [clip]);
    const glyphs = ["846", "886", "926"].map((y) => vertical.split("\n").find((row) => row.includes(`\\pos(960,${y})`)));
    expect(glyphs.every((row) => row?.includes("\\pos(") && !row.includes("\\move"))).toBe(true);
    expect(glyphs.map((row) => tags(row)[0])).toEqual(colors(3));
    const both = buildKaraokeAss(testClipLines(), undefined, defaultLook, [
      presetClip("3000|第二句", "第二句", 3000, 6000, "edge"),
    ]);
    const orig = both.split("\n").find((row) => row.includes("Dialogue: 0,0:00:03.00,") && row.includes(",Orig,"));
    const trans = both.split("\n").find((row) => row.includes("Dialogue: 0,0:00:03.00,") && row.includes(",Trans,"));
    expect(tags(orig)).toEqual(colors(3));
    expect(tags(trans)).toEqual(colors(5));
    const line = lyricLine(1_000, "甲乙", {
      translatedText: "丙",
      words: [
        { startMs: 0, durMs: 500, text: "甲" },
        { startMs: 500, durMs: 500, text: "乙" },
      ],
    });
    const timed = buildKaraokeAss([line], undefined, defaultLook, [presetClip("1000|甲乙", "甲乙", 1000, 15_500, "edge")]);
    const sung = timed.split("\n").find((row) => row.includes("\\k"));
    expect(sung).toContain("\\k");
    expect(sung).not.toContain("●");
    expect(tags(sung)).toEqual(colors(2));
    expect(timed).toContain(`\\1c${assColor(defaultLook.sungColor)}`);
  });

  it("有逐字嘅原文加微塵仍然保留 \\k，小點冇 \\k", () => {
    const line = lyricLine(1_000, "甲乙", {
      translatedText: "丙",
      words: [
        { startMs: 0, durMs: 500, text: "甲" },
        { startMs: 500, durMs: 500, text: "乙" },
      ],
    });
    const ass = buildKaraokeAss([line], undefined, defaultLook, [presetClip("1000|甲乙", "甲乙", 1000, 15_500, "dust")]);
    const orig = ass.split("\n").find((row) => row.includes("\\k"));
    expect(orig).toBeTruthy();
    expect(orig).not.toContain("●");
    const dots = ass.split("\n").filter((row) => row.includes("●"));
    expect(dots.length).toBeGreaterThan(0);
    expect(dots.every((row) => !row.includes("\\k"))).toBe(true);
  });

  it("舊檔重開冇小點", () => {
    expect(buildKaraokeAss(testClipLines())).not.toContain("●");
    const raw = exampleProject();
    const parsed = parseProject({
      ...raw,
      motion: [
        {
          id: "a",
          text: "第一句",
          startMs: 1000,
          endMs: 3000,
          lineKey: "1000|第一句",
          enter: { x: raw.style.x, y: raw.style.y, opacity: 1 },
          leave: { x: raw.style.x, y: raw.style.y, opacity: 1 },
          preset: "dust",
        },
      ],
    });
    expect(parsed.motion[0]?.preset).toBe("dust");
    expect(buildKaraokeAss(testClipLines(), undefined, defaultLook, parsed.motion)).toContain("●");
  });

  it("字距 0 的樣式間距仍然係 0", () => {
    const styles = buildKaraokeAss(testClipLines())
      .split("\n")
      .filter((row) => row.startsWith("Style:"));
    expect(styles).toHaveLength(2);
    expect(styles.every((row) => row.includes(",100,100,0,0,"))).toBe(true);
  });

  it("字距寫入兩個樣式，直排改字柱步進，歌詞仍然停住", () => {
    const spaced = buildKaraokeAss(testClipLines(), undefined, { ...defaultLook, tracking: 8 });
    const styles = spaced.split("\n").filter((row) => row.startsWith("Style:"));
    expect(styles.every((row) => row.includes(",100,100,8,0,"))).toBe(true);
    const lyric = spaced.split("\n").find((row) => row.includes("第一句"));
    expect(lyric).toContain("第一句");
    expect(lyric).toContain("\\pos(");
    expect(lyric).not.toContain("\\fsp");
    expect(lyric).not.toContain("\\move");
    expect(spaced).not.toContain("●");
    const vertical = buildKaraokeAss(testClipLines(), undefined, { ...defaultLook, flow: "vertical", size: 40, tracking: 10 });
    expect(vertical).toContain("\\pos(960,836)");
    expect(vertical).toContain("\\pos(960,886)");
    expect(vertical).toContain("\\pos(960,936)");
    expect(vertical).not.toContain("\\pos(960,846)");
    expect(vertical).not.toContain("\\pos(960,926)");
    expect(vertical).toContain(`\\fs${assFontSize(40, "chiron")}`);
    expect(vertical).not.toContain(`\\fs${assFontSize(50, "chiron")}`);
    const zero = buildKaraokeAss(testClipLines(), undefined, { ...defaultLook, flow: "vertical", size: 40, tracking: 0 });
    expect(zero).toContain("\\pos(960,846)");
    expect(zero).toContain("\\pos(960,926)");
  });

  it("未開柔邊就冇 \\blur", () => {
    expect(buildKaraokeAss(testClipLines())).not.toContain("\\blur");
    expect(defaultLook.soft).toBe(false);
  });

  it("柔邊只加喺歌詞，小點同位置保持原樣", () => {
    const look = { ...defaultLook, soft: true };
    const ass = buildKaraokeAss(testClipLines(), undefined, look);
    const lyric = ass.split("\n").find((row) => row.includes("第一句"));
    const trans = ass.split("\n").find((row) => row.includes("第二句譯文"));
    expect(lyric).toContain(`\\blur${softBlur}`);
    expect(lyric).not.toContain("\\blur4");
    expect(lyric?.match(/\\blur/g)).toHaveLength(1);
    expect(trans).toContain(`\\blur${softBlur}`);
    expect(ass).toContain("\\pos(");
    expect(ass).not.toContain("\\move");
    const flown = buildKaraokeAss(testClipLines(), undefined, look, [
      presetClip("1000|第一句", "第一句", 1000, 3000, "fly"),
    ]);
    const moving = flown.split("\n").find((row) => row.includes("第一句"));
    expect(moving).toContain("\\move");
    expect(moving).toContain(`\\blur${softBlur}`);
    const line = lyricLine(1_000, "甲乙", {
      words: [
        { startMs: 0, durMs: 500, text: "甲" },
        { startMs: 500, durMs: 500, text: "乙" },
      ],
    });
    const timed = buildKaraokeAss([line], undefined, look);
    expect(timed).toContain("\\k");
    expect(timed).toContain(`\\blur${softBlur}`);
    const dusty = buildKaraokeAss(testClipLines(), undefined, look, [
      presetClip("1000|第一句", "第一句", 1000, 3000, "dust"),
    ]);
    const dustLyric = dusty.split("\n").find((row) => row.includes("第一句"));
    const dots = dusty.split("\n").filter((row) => row.includes("●"));
    expect(dustLyric).toContain(`\\blur${softBlur}`);
    expect(dots.length).toBeGreaterThan(0);
    expect(dots.every((row) => !row.includes("\\blur"))).toBe(true);
    const vertical = buildKaraokeAss(testClipLines(), undefined, { ...look, flow: "vertical", size: 40 });
    expect(vertical).toContain("\\pos(960,846)");
    expect(vertical).toContain("\\pos(960,886)");
    expect(vertical).toContain("\\pos(960,926)");
    const glyphs = vertical.split("\n").filter((row) => row.includes("\\pos(960,886)") && !row.includes("●"));
    expect(glyphs.length).toBeGreaterThan(0);
    expect(glyphs.every((row) => row.includes(`\\blur${softBlur}`))).toBe(true);
  });

  it("譯文另揀字體，原文同小點留喺原款", () => {
    const look = { ...defaultLook, size: 40, transSize: 80, transFont: "kai" };
    const ass = buildKaraokeAss(testClipLines(), undefined, look);
    const orig = ass.split("\n").find((row) => row.startsWith("Style: Orig"));
    const trans = ass.split("\n").find((row) => row.startsWith("Style: Trans"));
    expect(orig?.startsWith(`Style: Orig,Chiron GoRound TC,${assFontSize(40, "chiron")},`)).toBe(true);
    expect(trans?.startsWith(`Style: Trans,KaiTi,${assFontSize(80, "kai")},`)).toBe(true);
    expect(trans).not.toContain("Chiron GoRound TC");
    const vertical = buildKaraokeAss(testClipLines(), undefined, { ...look, flow: "vertical" });
    const glyph = vertical.split("\n").find((row) => row.endsWith("譯"));
    const main = vertical.split("\n").find((row) => row.endsWith("第"));
    const transFit = fitPercent(Array.from("第二句譯文").length, 80, look.tracking, look.outline, look.transY, playHeight);
    expect(transFit).toBeLessThan(100);
    expect(glyph).toContain(`\\fs${assFontSize(80 * fitUsed(transFit), "kai")}`);
    expect(glyph).not.toContain(`\\fs${assFontSize(80 * fitUsed(transFit), "chiron")}`);
    expect(main).toContain(`\\fs${assFontSize(40, "chiron")}`);
    expect(main).not.toContain(`\\fs${assFontSize(40, "kai")}`);
    const dusty = buildKaraokeAss(testClipLines(), undefined, look, [
      presetClip("3000|第二句", "第二句", 3000, 6000, "dust"),
    ]);
    const dots = dusty.split("\n").filter((row) => row.includes("●"));
    const origDots = dots.filter((row) => row.includes(",Orig,"));
    const transDots = dots.filter((row) => row.includes(",Trans,"));
    const origPlaced = decorDots("dust", 3000, decorLayout("第二句", 40, false));
    const transPlaced = decorDots("dust", 3000, decorLayout("第二句譯文", 80, false));
    expect(origDots).toHaveLength(origPlaced.length);
    expect(transDots).toHaveLength(transPlaced.length);
    expect(origDots[0]).toContain(`\\fs${assFontSize(origPlaced[0].size, "chiron")}`);
    expect(origDots[0]).not.toContain(`\\fs${assFontSize(origPlaced[0].size, "kai")}`);
    expect(transDots[0]).toContain(`\\fs${assFontSize(transPlaced[0].size, "kai")}`);
    expect(transDots[0]).not.toContain(`\\fs${assFontSize(transPlaced[0].size, "chiron")}`);
    expect(transDots.every((row) => !row.includes("\\blur"))).toBe(true);
    const shared = buildKaraokeAss(testClipLines(), undefined, {
      ...defaultLook,
      font: "jhenghei",
      transFont: "jhenghei",
      tracking: 3,
    });
    const styles = shared.split("\n").filter((row) => row.startsWith("Style:"));
    expect(styles[0]?.startsWith("Style: Orig,Microsoft JhengHei,")).toBe(true);
    expect(styles[1]?.startsWith("Style: Trans,Microsoft JhengHei,")).toBe(true);
    expect(styles.every((row) => row.includes(",100,100,3,0,"))).toBe(true);
  });

  it("過長先收窄，短句唔寫 \\fscx，直排短句位置不變", () => {
    expect(buildKaraokeAss(testClipLines())).not.toContain("\\fscx");
    const text = "長".repeat(40);
    const percent = fitPercent(text.length, defaultLook.size, defaultLook.tracking, defaultLook.outline, defaultLook.x, playWidth);
    expect(percent).toBeLessThan(100);
    const line = lyricLine(1_000, text, {
      translatedText: "短",
      words: [
        { startMs: 0, durMs: 500, text: text.slice(0, 20) },
        { startMs: 500, durMs: 500, text: text.slice(20) },
      ],
    });
    const ass = buildKaraokeAss([line]);
    const orig = ass.split("\n").find((row) => row.includes(",Orig,"));
    const trans = ass.split("\n").find((row) => row.includes(",Trans,"));
    expect(orig).toContain(`\\fscx${percent}`);
    expect(orig).toContain("\\k");
    expect(orig).not.toContain("\\fscy");
    expect(orig).not.toContain("\\N");
    expect(orig).not.toContain("\\move");
    expect(trans).not.toContain("\\fscx");
    const scaled = buildKaraokeAss([line], undefined, defaultLook, [presetClip("1000|" + text, text, 1000, 3000, "scale")]);
    const pulsing = scaled.split("\n").find((row) => row.includes(",Orig,"));
    const end = percent;
    const start = Math.max(1, Math.round((82 * end) / 100));
    expect(pulsing).toContain(`\\fscx${start}\\fscy82\\t(0,300,\\fscx${end}\\fscy100)`);
    expect(pulsing).not.toContain("\\fscx100");
    const dusty = buildKaraokeAss([line], undefined, defaultLook, [presetClip("1000|" + text, text, 1000, 3000, "dust")]);
    const dots = dusty.split("\n").filter((row) => row.includes("●") && row.includes(",Orig,"));
    const layout = decorLayout(text, defaultLook.size, false, fitUsed(percent));
    const placed = decorDots("dust", 2000, layout);
    expect(layout.extent).toBe(text.length * defaultLook.size * fitUsed(percent));
    expect(decorLayout(text, defaultLook.size, false).extent).toBe(text.length * defaultLook.size);
    expect(dots).toHaveLength(placed.length);
    expect(dots[0]).toContain(`\\move(${960 + placed[0].x},${886 + placed[0].y},`);
    expect(dots.every((row) => !row.includes("\\fscx") && !row.includes("\\blur") && !row.includes("\\k"))).toBe(true);
    const column = "直".repeat(16);
    const uprightLook = { ...defaultLook, flow: "vertical" as const, y: 0.5, outline: 0 };
    const uprightPercent = fitPercent(column.length, uprightLook.size, 0, 0, 0.5, playHeight);
    const used = fitUsed(uprightPercent);
    expect(uprightPercent).toBeLessThan(100);
    const upright = buildKaraokeAss([lyricLine(1_000, column)], undefined, uprightLook);
    const step = uprightLook.size * used;
    const y0 = Math.round(0.5 * playHeight + (0 - (column.length - 1) / 2) * step);
    expect(upright).toContain(`\\fs${assFontSize(uprightLook.size * used, "chiron")}`);
    expect(upright).toContain(`\\pos(960,${y0})`);
    expect(upright).not.toContain("\\fscx");
    expect(upright).not.toContain(`\\fs${assFontSize(uprightLook.size, "chiron")}`);
    const short = buildKaraokeAss(testClipLines(), undefined, { ...defaultLook, flow: "vertical" as const, size: 40 });
    expect(short).toContain("\\pos(960,846)");
    expect(short).toContain("\\pos(960,886)");
    expect(short).toContain("\\pos(960,926)");
  });

  it("句頭句尾淡入淡出，短句自動縮，小點唔跟", () => {
    const plain = buildKaraokeAss(testClipLines());
    const first = plain.split("\n").find((row) => row.startsWith("Dialogue: 0,0:00:01.00,") && row.includes(",Orig,"));
    const second = plain.split("\n").find((row) => row.includes("第二句譯文"));
    expect(first).toContain("\\fad(50,50)");
    expect(second).toContain("\\fad(50,50)");
    expect(first).not.toContain("\\fade");
    const cut = setLineFade([], "1000|第一句", "第一句", 1000, 3000, "in", 0);
    const hard = setLineFade(cut, "1000|第一句", "第一句", 1000, 3000, "out", 0);
    const cutAss = buildKaraokeAss(testClipLines(), undefined, defaultLook, hard);
    const cutRow = cutAss.split("\n").find((row) => row.startsWith("Dialogue: 0,0:00:01.00,") && row.includes(",Orig,"));
    expect(cutRow).not.toContain("\\fad");
    expect(cutRow).not.toContain("\\fade");
    const brief = lyricLine(1_000, "短句", { translatedText: "短譯" });
    const next = lyricLine(1_160, "下一句");
    const short = buildKaraokeAss([brief, next]);
    const shortOrig = short.split("\n").find((row) => row.includes("短句") && row.includes(",Orig,"));
    const shortTrans = short.split("\n").find((row) => row.includes("短譯"));
    expect(shortOrig).toContain("\\fad(40,40)");
    expect(shortTrans).toContain("\\fad(40,40)");
    const upright = buildKaraokeAss(testClipLines(), undefined, { ...defaultLook, flow: "vertical", size: 40 });
    const glyphs = upright.split("\n").filter((row) => row.endsWith("第") || row.endsWith("一") || row.endsWith("句"));
    expect(glyphs.length).toBeGreaterThan(0);
    expect(glyphs.every((row) => row.includes("\\fad(50,50)"))).toBe(true);
    const dusty = buildKaraokeAss(testClipLines(), undefined, defaultLook, [
      presetClip("1000|第一句", "第一句", 1000, 3000, "dust"),
    ]);
    const lyric = dusty.split("\n").find((row) => row.includes("第一句") && !row.includes("●"));
    const dots = dusty.split("\n").filter((row) => row.includes("●"));
    expect(lyric).toContain("\\fad(50,50)");
    expect(dots.length).toBeGreaterThan(0);
    expect(dots.every((row) => !row.includes("\\fad(") && row.includes("\\fade(255,"))).toBe(true);
    const soft = buildKaraokeAss(testClipLines(), undefined, { ...defaultLook, soft: true });
    const softRow = soft.split("\n").find((row) => row.startsWith("Dialogue: 0,0:00:01.00,") && row.includes(",Orig,"));
    expect(softRow).toContain(`\\fad(50,50)\\blur${softBlur}`);
  });

  it("正的延遲讓字幕晚出現", () => {
    const ass = buildKaraokeAss(testClipLines(), { ...defaultTiming(), offsetMs: 50 });
    expect(ass).toContain("0:00:01.05");
  });
});

function presetClip(key: string, text: string, startMs: number, endMs: number, preset: NonNullable<MotionClip["preset"]>): MotionClip {
  const clip = setLinePreset([], key, text, startMs, endMs, preset)[0];
  if (!clip) throw new Error("missing clip");
  return clip;
}
