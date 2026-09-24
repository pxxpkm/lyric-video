# 交接

2026-09-24。使用者說「M7收貨」，並指定 M8 做先前缺失的功能：貼上 YouTube 連結後查詞，預覽要看得到對應歌詞，還要有像 DesktopLyric 的選擇歌詞畫面。新對話先讀這份，再讀 `AGENTS.md`。

M7 已收貨。不要把時機畫面改回 DesktopLyric。M8 的範圍以 `docs/dev-plan.md` 的 M8 為準。

## 現在停在哪

M0 到 M7 已提交。M7 的訊息是 `M7：打包、連續佇列與打包後匯出`。

M8 還沒開始寫程式。已定範圍裡的四源搜詞和揀歌，先前只做了離線評分，沒有連網，也沒有選擇歌詞畫面。

安裝檔在 `release\LyricVideo Setup 0.0.0.exe`。免安裝可開 `release\win-unpacked\LyricVideo.exe`。`release/` 被 gitignore，不進 commit。M7 提交時的安裝檔是字體路徑修正之後打的。

自動測試在 M7 提交前是 142 項通過。

## 產品現況

Electron + TypeScript + React。歌詞核心在 `src/core`，不連網。yt-dlp 和 ffmpeg 在主程序。四源搜詞的解析和評分在 `src/core`，主程序還沒有發出搜詞請求。預覽用 `<video>` / `<audio>` 的 `currentTime`，不要套 DesktopLyric 的 `PlaybackClock`。

已提交的能力：匯入連結或本機檔、離線搜詞評分、測試片預覽、選句改時機、按「匯出 MP4」才燒 `karaoke.ass`、打包與連續佇列。字體是 `fonts/ChironGoRoundTC-Regular.ttf`（昭源圓體，約 27MB）。

開發時專案在這個資料夾的 `studio-data\`。打包後的程式改放 `%AppData%` 底下的 `studio-data`，不在 repo 裡。

## 時機畫面已經定下來的行為

這些是使用者改過並收貨的，不要擅自改回 DesktopLyric：

- 正的延遲把句子往後推。`lyricClockMs` 是 `(媒體時間 - 延遲) * 速度`。列表上的時間用 `mediaMsForLyric`。
- 延遲按鈕是「−50 ms」「+50 ms」。提示分別是「歌詞慢了」「歌詞快了」。− 是歌詞出得太晚，要把句子提前。+ 是歌詞出得太早，要把句子押後。
- 速度按鈕是「−」「＋」，數字後面有 `x`，例如 `1.000x`。歸零回到 1。
- 延遲和速度各自有歸零（橢圓）和上一步（彎箭）。沒有一個總「復原」。長按一整段只算上一步一次。
- 所有加減按鈕可以長按。按下立刻一步；按住約 400ms 後每 60ms 再一步。毫秒類會加快到 250、再加快到 1000。停留每次仍是 0.25 秒。速度每次仍是 0.005。
- 先點選一句，才改「呢句」和「停留」。停留中間平時顯示 `0.00s`。不是 0 時，列表那一行也寫 `停留+0.25s`。
- 清單不跟著播放自動捲。
- 返回是左上角的左箭頭，不在底部。
- 未按「匯出 MP4」不產生 `out.mp4`。沒有歌詞時按鈕不能按。

## M7 已收貨的內容

- `npm run dist` 出 win-x64 NSIS。設定在 `package.json` 的 `build`。字典和字體用 extraResources，打包後從 `process.resourcesPath` 讀。
- 匯入頁有佇列：多行網址會一條做完才做下一條，每條停在「可預覽」，不會自己匯出。同一時間只准一條匯出。
- 設定：轉繁體勾著且不能關，顯示譯文可關，羅馬字是「稍後」不能勾。
- 未接住的例外會追加到 `%AppData%\LyricVideoStudio\crash.log`。
- 打包後字體路徑含空格時，匯出濾鏡用 `../../export-fonts`，字體複製到 `%AppData%\lyric-video\export-fonts`。

打包沒有自訂圖示，用了 Electron 預設圖示。yt-dlp 和 ffmpeg 沒有打進安裝檔，仍然靠這部電腦的 PATH。

## M8

連網四源搜詞，以及選擇歌詞畫面。貼上連結後，預覽要嘛有對應歌詞，要嘛先讓人揀。細節在 `docs/dev-plan.md` 的 M8。

下面這些仍只是寫程式時知道容易壞的地方，使用者沒有把它們點名成 bug：

- 佇列用網址是不是以 `http` 開頭來分辨檔案。本機路徑若不像網址會當檔案。
- 字體路徑含空格時，ffmpeg 的 `ass` 濾鏡會斷。絕對路徑跳脫已經試過，不行。濾鏡只放沒有空格和冒號的相對路徑；打包後先複製到 `%AppData%\lyric-video\export-fonts`。不要改回跳脫。
- `queue.ts` 對 `importService`、`testClip` 又靜態又動態 import，打包時 Vite 有警告。
- 安裝檔沒有簽名以外的圖示，`package.json` 沒有 author，electron-builder 只是警告。

## 怎麼打開

PowerShell 路徑有空格，必須加引號：

```powershell
cd "C:\Users\Leo\Lyric Video"
npm run dev
```

Git 只在這個資料夾做。這部電腦沒有 git 作者設定，不要執行 `git config`。提交時用環境變數帶 `LeoP` / `182622846+pxxpkm@users.noreply.github.com`。不要碰 `C:\` 那個被 Git 當成儲存庫的目錄。細節在 `docs/pitfalls.md`。

使用者沒說通過，就不要 commit。
