import { beforeAll, describe, expect, it } from "vitest";
import { lyricLine } from "../../src/core/lyrics";
import { applyLyricsToProject, finishLyricLines, formatDurationDelta, lyricHits } from "../../src/core/lyricMatch";
import { exampleProject } from "../../src/core/project";
import { installProjectDict } from "../installDict";

beforeAll(installProjectDict);

describe("歌詞套進專案", () => {
  it("簡體轉成繁體，整首偏移和速度留著", () => {
    const project = exampleProject();
    project.timing.offsetMs = 50;
    project.timing.rate = 1.01;
    project.timing.lines = { "1000|舊句": 50 };
    const next = applyLyricsToProject(
      project,
      [lyricLine(1_500, "音乐", { translatedText: "music" })],
      { key: "ncm:1", source: "網易雲", score: 1, autoAccepted: true, reason: "自動採用" },
    );
    expect(next.lyrics.lines[0].text).toBe("音樂");
    expect(next.lyrics.candidateKey).toBe("ncm:1");
    expect(next.timing.offsetMs).toBe(50);
    expect(next.timing.rate).toBe(1.01);
    expect(next.timing.lines).toEqual({});
    expect(next.decision.reason).toBe("要人看");
    expect(next.decision.autoAccepted).toBe(false);
  });

  it("時長差用減號，用不上時長就明講", () => {
    expect(formatDurationDelta(2_000)).toBe("時長差 +2.0s");
    expect(formatDurationDelta(-1_500)).toBe("時長差 −1.5s");
    expect(formatDurationDelta(null)).toBe("時長未用");
    expect(lyricHits([], null)).toEqual([]);
  });

  it("沒有簡體的句子保持原字", () => {
    expect(finishLyricLines([lyricLine(0, "窗外的麻雀")])[0].text).toBe("窗外的麻雀");
  });
});
