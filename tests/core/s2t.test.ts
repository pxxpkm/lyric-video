import { beforeAll, describe, expect, it } from "vitest";
import { convert } from "../../src/core/s2t";
import { hasKana, isJapaneseLine } from "../../src/core/text";
import { installProjectDict } from "../installDict";

beforeAll(installProjectDict);

describe("s2t", () => {
  it("轉常用字", () => {
    expect(convert("我爱你")).toBe("我愛你");
  });

  it("已是繁體就保持", () => {
    expect(convert("這是繁體")).toBe("這是繁體");
  });

  it("中英混合", () => {
    const result = convert("I love 音乐 and 梦想") ?? "";
    expect(result).toContain("樂");
    expect(result).toContain("夢");
    expect(result).toContain("I love");
  });

  it("空字串與 null", () => {
    expect(convert("")).toBe("");
    expect(convert(null)).toBeNull();
  });

  it("七里香一句", () => {
    const result = convert("雨下整夜 我的爱溢出就像雨水") ?? "";
    expect(result).toContain("愛");
    expect(result).toContain("溢");
  });

  it("舊手寫表沒有的字", () => {
    expect(convert("歌词颜帅无处")).toBe("歌詞顏帥無處");
  });

  it.each([
    ["头发", "頭髮"],
    ["发丝", "髮絲"],
    ["发型", "髮型"],
    ["里面", "裏面"],
    ["这里", "這裏"],
    ["心里", "心裏"],
    ["什么", "什麼"],
    ["怎么", "怎麼"],
    ["那么", "那麼"],
    ["这么", "這麼"],
    ["干净", "乾淨"],
    ["干杯", "乾杯"],
    ["干活", "幹活"],
    ["后面", "後面"],
    ["落后", "落後"],
    ["杰作", "傑作"],
    ["忧郁", "憂鬱"],
    ["云端", "雲端"],
    ["一只猫", "一隻貓"],
    ["伙伴", "夥伴"],
    ["于是", "於是"],
    ["剩余", "剩餘"],
    ["发现", "發現"],
    ["关系", "關係"],
  ])("%s → %s", (simplified, traditional) => {
    expect(convert(simplified)).toBe(traditional);
  });

  it("不拆開有歧義的詞", () => {
    expect(convert("皇后")).toBe("皇后");
    expect(convert("公里")).toBe("公里");
    expect(convert("只是")).toBe("只是");
  });

  it("香港用字", () => {
    expect(convert("为")).toBe("為");
    expect(convert("台湾")).toBe("台灣");
  });

  it("日文整句不動", () => {
    expect(convert("君の知らない物語")).toBe("君の知らない物語");
    expect(convert("夕暮れ 駆け抜けた")).toBe("夕暮れ 駆け抜けた");
  });

  it("中文逐字會轉，假名不轉", () => {
    expect(convert("在")).toBe("在");
    expect(convert("黄昏")).toBe("黃昏");
    expect(convert("け")).toBe("け");
  });
});

describe("假名", () => {
  it("有假名算日文，純中文不算", () => {
    expect(hasKana("君の知らない物語")).toBe(true);
    expect(hasKana("ありがとう")).toBe(true);
    expect(hasKana("雨下整夜 我的愛溢出就像雨水")).toBe(false);
    expect(hasKana("hello")).toBe(false);
  });

  it("整句有假名時，漢字碎片也算日文", () => {
    expect(isJapaneseLine("駆", "夕暮れ駆け抜けた")).toBe(true);
    expect(isJapaneseLine("在黃昏中奔馳", "在黃昏中奔馳")).toBe(false);
  });
});
