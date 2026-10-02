import { describe, expect, it } from "vitest";
import { assFileName, exportPartPath, mp4FileName } from "../../src/core/exportName";

describe("匯出檔名", () => {
  it("預設用歌名", () => {
    expect(mp4FileName("七里香")).toBe("七里香.mp4");
    expect(mp4FileName("  live / 版? ")).toBe("live 版.mp4");
    expect(mp4FileName("")).toBe("歌詞影片.mp4");
    expect(mp4FileName("結尾.")).toBe("結尾.mp4");
    expect(assFileName("七里香")).toBe("七里香.ass");
    expect(assFileName("  live / 版? ")).toBe("live 版.ass");
    expect(assFileName("")).toBe("歌詞影片.ass");
  });

  it("暫存檔以 .mp4 結尾，檔名不以點開頭", () => {
    const part = exportPartPath("C:\\Users\\Leo\\Lyric Video\\studio-data\\yt-3e3616\\海奏ララバイ.mp4");
    expect(part.endsWith("\\海奏ララバイ.part.mp4")).toBe(true);
    expect(part.endsWith(".part")).toBe(false);
  });
});
