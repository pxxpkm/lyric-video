# 踩坑紀錄

`AGENTS.md` 只保留這份檔的路徑。坑寫在這裡，不要寫回 `AGENTS.md`。

新遇到的坑加在「本專案已遇到」的最上面。每一則包含：日期、現象、原因、對策、影響哪一步。

## 本專案已遇到

### 2026-09-24 匯出用的暫存檔名以 `.part` 結尾，ffmpeg 認不出封裝格式

- 現象：匯出「海奏ララバイ」時，ffmpeg 報 `Error initializing the muxer for ...\.海奏ララバイ.mp4.part: Invalid argument`，沒有成片。
- 原因：暫存檔從 `out.part.mp4` 改成 `.${歌名}.mp4.part`。ffmpeg 用最後一段副檔名挑封裝，`part` 對不上 mp4。檔名以點開頭也容易被當成隱藏檔。
- 對策：暫存檔是 `海奏ララバイ.part.mp4`。副檔名留在最後，檔名不以點開頭。寫完再改名成 `海奏ララバイ.mp4`。
- 影響：M8 匯出。

### 2026-09-24 打包後匯出，ass 濾鏡被字體路徑裡的空格切斷

- 現象：用 `release\win-unpacked\LyricVideo.exe` 匯出測試片，畫面停在 `Error parsing filterchain 'ass=karaoke.ass:fontsdir=C\:/Users/Leo/Lyric\ Video/release/win-unpacked/resources/fonts'`，接著打不開 `out.part.mp4`，回報 `Invalid argument`。沒有 `out.mp4`。
- 原因：ffmpeg 的 ass 濾鏡用冒號和空格切參數。字體在 `Lyric Video\release\...\resources\fonts`。把磁碟機冒號寫成 `C\:`、空格寫成 `\ ` 仍會斷，ffmpeg 會說 `No option name near '/Users/Leo/Lyric Video/...'`。開發時字體和片子在同一棵樹，相對路徑 `../../fonts` 沒有空格，所以先前能匯出。
- 對策：濾鏡的 `fontsdir` 只放 `[A-Za-z0-9._/-]` 這種相對路徑，工作目錄仍是該片資料夾。打包後相對路徑含空格時，先把字體複製到 `%AppData%\lyric-video\export-fonts`，濾鏡用 `../../export-fonts`。不要改回絕對路徑跳脫。
- 影響：M7 匯出。

### 2026-09-24 `npm install` 之後 Electron 本體不在

- 現象：`npm run dev` 報 `Error: Electron uninstall`。`node_modules/electron` 有套件，沒有 `path.txt` 和 `dist/electron.exe`。
- 原因：二進位要由套件裡的 `install.js` 另外下載。這次 `npm install` 沒有把它留下。
- 對策：在專案目錄執行 `node node_modules/electron/install.js`。不要改 npm 的 `ignore-scripts`。
- 影響：M0 開視窗。

### 2026-09-24 electron-vite 5 不能配最新的 Vite 8

- 現象：一次安裝 `electron-vite` 和 `@vitejs/plugin-react` 時，npm 報 ERESOLVE。`@vitejs/plugin-react` 6 要 Vite 8，`electron-vite` 5 只接受 Vite 5 到 7。
- 原因：兩個套件的 peer 範圍沒有交集。
- 對策：鎖 `electron-vite@5`、`vite@7`、`@vitejs/plugin-react@5`、`vitest@3`。不要為了過安裝加 `--force`。
- 影響：M0 的依賴。以後升級 electron-vite 再一起看 Vite。

### 2026-09-24 這部電腦沒有設定 git 作者

- 現象：`git config user.name` 和 `user.email` 都是空的。直接 commit 會停下來問你是誰。
- 原因：沒有全域或本機的 git 身份。
- 對策：不要執行 `git config`（也不要加 `--global`）。這份儲存庫的提交用環境變數帶作者，沿用你在 DesktopLyric 用的 `LeoP` / `182622846+pxxpkm@users.noreply.github.com`，而且只對那一次命令有效。若要改作者，跟使用者確認後再改做法。
- 影響：本目錄的每一個 commit。

### 2026-09-24 在專案目錄執行 git，卻碰到 `C:\` 的儲存庫

- 現象：當時本目錄還沒有 `.git`。執行 `git status` 向上找到 `C:\`，並因擁有者是 `NT SERVICE\TrustedInstaller` 而報 dubious ownership。
- 原因：Git 會向上找 `.git`。這個專案自己的儲存庫尚未建立。
- 對策：只在 `C:\Users\Leo\Lyric Video` 裡 `git init` 和提交。不要執行 `git config --global --add safe.directory C:/`。不要在 `C:\` 做任何 git 操作。
- 影響：文件這一步通過人手驗證之後的第一個 commit。

## 從 DesktopLyric 帶過來的約束

下面這些已在 DesktopLyric 發生過。本專案直接遵守，不要用實作再試一次來確認。

- 網易雲舊的 `/api/search/get` 會忽略關鍵字。搜尋用 `cloudsearch`。
- YouTube 的 mix、長片用整段時長對歌會配錯。20 秒以下或 12 分鐘以上的時長不用來對歌詞。
- 連唱、空檔、譯文配對、快慢步進那些常數改了，現場版和雙語行會整批錯位。
- 網易雲 YRC 常把日文和中文壓在同一行，要拆開，中文當譯文。逐字超過 80 個就不要再做逐字高亮。
- 時機介面若每一拍都重建清單或把當前句捲進畫面，會卡、會跳。清單虛擬化，捲動不要跟著播放走。
- 模糊陰影在桌面歌詞的分層視窗上曾弄垮繪圖。這裡的歌詞用描邊，不做模糊陰影。
- `%AppData%\DesktopLyric\` 是已發行程式的資料。讀寫會弄髒使用者的桌面歌詞。
