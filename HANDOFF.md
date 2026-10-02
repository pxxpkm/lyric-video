# 交接

2026-10-02。新對話先讀這份，再讀 `AGENTS.md`。進度以 `docs/dev-plan.md` 為準，坑以 `docs/pitfalls.md` 為準。不要靠上一段聊天。

使用者說程式尚算完整，已經可以公開，改善之處這輪沒有逐條列完。0.10 已通過並會寫入本地提交，尚未 push。未叫就不要開始下一步。

## 現在停在哪

公開倉庫：https://github.com/pxxpkm/lyric-video （public，`master`）。

已推上去的最新提交是 `bee527e`，訊息 `0.6：成首位置、逐句位置、直排同分開的原文譯文`。本地在 `a444c23`（0.9）之上再提交 0.10，訊息 `0.10：字距`。0.7 是 `44a2d42`，0.8 是 `116890b`，0.9 是 `a444c23`。0.7、0.8、0.9、0.10 都未 push。`package.json` 版本仍是 `0.5.0`。給外人看的說明在 `README.md`。程式碼還沒有另立授權檔。`0144858` 是 beta 0.5，已包含 M8。使用者沒有親口說「M8 可以」。不要為了補這句話再提交一次。

**0.6 已完成並已 push。** **0.7 已完成，未 push。** **0.8 已完成，未 push。** **0.9 已完成，未 push。** **0.10 已完成，未 push。** 字體頁有字距，0 同未加之前一樣。未叫就不要開始下一步。柔邊同譯文另選字體未做。

安裝檔仍是 `release\LyricVideo Setup 0.0.0.exe`（M7 那次）。`release/` 不進 git。沒叫打包就不要 `npm run dist`。

## 寫程式前要對的文件

- 已收貨、不要改回的時機畫面，以及 0.6、0.7 的範圍：`docs/dev-plan.md`。
- 匯出暫存檔名、字體路徑含空格、拖時間要按位元組範圍讀媒體：`docs/pitfalls.md` 最上面。

## 怎麼打開

PowerShell 路徑有空格，必須加引號：

```powershell
cd "C:\Users\Leo\Lyric Video"
npm run dev
```

Git 只在這個資料夾做。這部電腦沒有 git 作者設定，不要執行 `git config`。提交時用環境變數帶 `LeoP` / `182622846+pxxpkm@users.noreply.github.com`。不要碰 `C:\` 那個被 Git 當成儲存庫的目錄。遠端是 `origin`。不要 force push。
