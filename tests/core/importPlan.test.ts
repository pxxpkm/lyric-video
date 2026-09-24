import { describe, expect, it } from "vitest";
import {
  planImport,
  projectFromImport,
  readDownloadPercent,
  readFfprobeDuration,
  readYtdlpDump,
  titleFromFileName,
} from "../../src/core/importPlan";

const unlocked = { lockTitle: false, lockArtist: false, title: "", artist: "" };

describe("匯入計劃", () => {
  it("在下載前就清理 YouTube 標題", () => {
    const draft = planImport(
      { rawTitle: "大原ゆい子「ユビオリ」 Live Ver.", rawArtist: "大原ゆい子 - Topic", durationMs: 4 * 60_000 },
      unlocked,
    );
    expect(draft.title).toBe("ユビオリ");
    expect(draft.artist).toBe("大原ゆい子");
    expect(draft.mode).toBe("video");
    expect(draft.useDuration).toBe(true);
    expect(draft.note).toBe("");
  });

  it("本機檔名去掉副檔名再清理", () => {
    expect(titleFromFileName("C:\\Music\\大原ゆい子「ユビオリ」 Live Ver.mp4")).toBe(
      "大原ゆい子「ユビオリ」 Live Ver",
    );
  });

  it("12 分鐘或以上預設音訊，而且不用片長對歌", () => {
    const draft = planImport(
      { rawTitle: "mix", rawArtist: "channel", durationMs: 20 * 60_000 },
      unlocked,
    );
    expect(draft.mode).toBe("audio");
    expect(draft.useDuration).toBe(false);
    expect(draft.note).toContain("12 分鐘");
    expect(draft.durationMs).toBe(20 * 60_000);
  });

  it("太短的時長也不用來對歌", () => {
    const draft = planImport({ rawTitle: "短片", rawArtist: "", durationMs: 8_000 }, unlocked);
    expect(draft.useDuration).toBe(false);
    expect(draft.mode).toBe("video");
  });

  it("鎖住的歌名和歌手不會被覆蓋", () => {
    const draft = planImport(
      { rawTitle: "大原ゆい子「ユビオリ」 Live Ver.", rawArtist: "someone", durationMs: 90_000 },
      { lockTitle: true, lockArtist: true, title: "自訂", artist: "我" },
    );
    expect(draft.title).toBe("自訂");
    expect(draft.artist).toBe("我");
  });

  it("讀 yt-dlp 和 ffprobe 的假輸出", () => {
    const dump = readYtdlpDump('warn\n{"id":"abc","title":"七里香","uploader":"周杰倫","duration":271.2}\n');
    expect(dump).toEqual({ id: "abc", title: "七里香", uploader: "周杰倫", durationMs: 271_200 });
    expect(readYtdlpDump('{"id":"abc","title":"七里香","channel":"周杰倫","duration":null}')?.uploader).toBe(
      "周杰倫",
    );
    expect(readYtdlpDump("not json")).toBeNull();
    expect(readFfprobeDuration('{"format":{"duration":"269.5"}}')).toBe(269_500);
    expect(readDownloadPercent("[download]  12.5% of 3.00MiB")).toBe(12.5);
    expect(readDownloadPercent("nothing")).toBeNull();
  });

  it("建立的專案不是匯出檔", () => {
    const project = projectFromImport({
      kind: "file",
      url: "",
      mediaPath: "C:\\Music\\song.m4a",
      title: "ユビオリ",
      artist: "大原ゆい子",
      durationMs: 90_000.4,
      mode: "audio",
      lockTitle: false,
      lockArtist: true,
    });
    expect(project.source.mediaPath).toBe("C:\\Music\\song.m4a");
    expect(project.source.mediaPath.endsWith("out.mp4")).toBe(false);
    expect(project.identity.durationMs).toBe(90_000);
    expect(project.identity.lockArtist).toBe(true);
    expect(project.lyrics.lines).toEqual([]);
  });
});
