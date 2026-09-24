import { describe, expect, it } from "vitest";
import { exampleProject, parseProject } from "../../src/core/project";

describe("project schema", () => {
  it("接受一份空的專案", () => {
    expect(parseProject(exampleProject())).toEqual(exampleProject());
  });

  it("拒絕版本不對的檔", () => {
    expect(() => parseProject({ ...exampleProject(), version: 2 })).toThrow();
  });

  it("補上省略的歌詞欄位", () => {
    const raw = exampleProject();
    const line = { atMs: 1000, text: "一句" };
    const parsed = parseProject({
      ...raw,
      lyrics: { ...raw.lyrics, lines: [line] },
    });
    expect(parsed.lyrics.lines[0]).toEqual({ ...line, trans: "", words: [] });
  });
});
