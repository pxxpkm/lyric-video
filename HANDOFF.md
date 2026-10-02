# 交接

2026-10-02。新對話先讀這份，再讀 `AGENTS.md`。進度以 `docs/dev-plan.md` 為準，坑以 `docs/pitfalls.md` 為準。不要靠上一段聊天。

使用者說程式尚算完整，已經可以公開，改善之處這輪沒有逐條列完。不要改沒點名的畫面，也不要自己開始 0.7 或粒子。

## 現在停在哪

公開倉庫：https://github.com/pxxpkm/lyric-video （public，`master`）。

已推上去的最新提交仍是 `0144858`，訊息 `beta 0.5：搜詞、字體、進度條與自選匯出`。`package.json` 版本是 `0.5.0`。給外人看的說明在 `README.md`。程式碼還沒有另立授權檔。這個提交已包含 M8。使用者沒有親口說「M8 可以」。不要為了補這句話再提交一次。

**0.6 成首位置同逐句位置已完成。** 2026-10-02 使用者說「0.6 可以」。提交訊息是 `0.6：成首位置、逐句位置、直排同分開的原文譯文`。這次提交尚未 push。不要開始 0.7，也不要做粒子。

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
