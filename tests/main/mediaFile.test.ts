import { describe, expect, it } from "vitest";
import { mediaType, parseByteRange } from "../../src/main/mediaFile";

describe("媒體分段", () => {
  it("整段和指定範圍", () => {
    expect(parseByteRange(null, 1000)).toBeNull();
    expect(parseByteRange("bytes=0-", 1000)).toEqual({ start: 0, end: 999 });
    expect(parseByteRange("bytes=100-199", 1000)).toEqual({ start: 100, end: 199 });
    expect(parseByteRange("bytes=900-", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseByteRange("bytes=-200", 1000)).toEqual({ start: 800, end: 999 });
  });

  it("影片用 mp4 類型", () => {
    expect(mediaType("C:\\song.mp4")).toBe("video/mp4");
    expect(mediaType("C:\\tone.wav")).toBe("audio/wav");
  });
});
