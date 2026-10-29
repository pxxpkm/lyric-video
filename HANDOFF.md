# 交接

## 2026-10-30 素材管理驗收通過

使用者明確回覆「過了驗收。」本步素材重用、檢視、逐檔／全部清除、保留未確認檔案及開發埠 15173 已驗收。265 項測試、TypeScript、build 通過；本輪只整理完成狀態及提交，不再改產品程式。提交訊息「新增下載素材重用、檢視及安全清除」，含相關文件及審查。未打包、未 push；exass/、影音、Cookies、工具及建置產物不提交。沒有下一個進行中的產品步驟；R01–R11 仍未修，後續優先保存可靠性，再處理匯出保護，詳見 docs/review-2026-10-30.md。下方所有待驗描述為歷史紀錄。

## 2026-10-30 清除範圍修正（待使用者驗收）

本輪嘗試代開時 15173 已被另一個本專案 electron-vite dev（PID 12040，父 16840）使用，HTTP 200。沒有關閉該程序或另換埠，未確認其視窗已載入新主程序；請使用者先在原終端 Ctrl+C，再 npm run dev 驗證。歷史「已停止」只指代理先前 session 2062。

已按使用者指定修清除分類。新增 downloadReceipt.ts；新下載結束後記 download-files.json，清除要求大小及時間相符。舊版只接納同資料夾 YouTube 專案明確引用的標準來源檔，舊殘檔及 source.final.mp4 等不明用途檔顯示保留、全部清除略過。單個／批次確認後再核對檔案狀態。265 項測試、TypeScript、build 通過，未清除真實素材；README 已補行為限制。下一步只做人手驗收目前素材功能，不開下一里程碑，未 commit／打包／push。

## 2026-10-30 本機覆核完成（產品步驟仍待驗）

使用者要求查文件及掃描專案，交付 docs/review-2026-10-30.md。262 項測試、TypeScript、build 通過；R01–R11 現行路徑未修正。新發現清除只按 yt-*/source.* 分類，會把另存為 source.final.mp4 的成片列入，已用 TEMP 文字替身重現；未清除真實素材。建議先收窄分類再驗收目前素材步驟，之後優先可靠保存及匯出保護；詳見報告。這輪只加文件，未改產品程式碼，未 commit／打包／push。

上一輪 session 2062 已按使用者要求停止，15173 已確認連線拒絕；下面「仍運行」是歷史記錄。素材功能及埠修改仍未收到明確驗收通過。

## 2026-10-30 追加全部清除（同一步待驗）

使用者要求「全部清除」按鈕，已加到素材表。主程序掃描確認時清單，對話框列總數、大小及引用專案，預設取消；確認後只逐檔處理這份清單，每檔重新驗證路徑及忙碌狀態，移至資源回收筒。回報成功數與未清除檔名；不刪設定，測試未實際清除使用者素材。262 項離線測試、TypeScript 通過。請使用者重開開發版驗證按鈕及取消／確認。未 commit、未打包、未 push。

## 2026-10-30 開發埠權限修正（同一步待驗）

使用者 npm run dev 遇 127.0.0.1:5173 EACCES。本機 Node bind 測試 5173、5183 均 EACCES，15173 成功；netsh IPv4 保留清單未列 5173，未確定限制來源。electron.vite.config.ts 明確 port 15173，保留 IPv4 及 strictPort。TypeScript 通過；代理已啟動 npm run dev（session 2062），伺服器顯示 http://127.0.0.1:15173/ 並開始 Electron。未改 Windows 網絡設定，未關舊程序，待使用者驗證畫面及素材功能。未提交。

## 2026-10-30 追加素材檢視表及清除（待人手驗證）

同一本機素材重用步驟追加 CacheLibrary.tsx、cacheLibrary.ts 及 IPC/preload 型別；匯入頁入口「下載素材／清除緩存」。逐檔列大小、時間及引用專案，確認對話框後移至 Windows 資源回收筒，不刪專案設定。260 項離線測試、TypeScript、build 通過。未實際清除使用者素材，待使用者重開開發版驗證表格、取消／確認清除及重新下載。未 commit、未打包、未 push；exass/ 不動。詳細限制與人手驗證見 dev-plan 最新紀錄。

## 2026-10-30 YouTube 重用本機下載（待人手驗證）

使用者要求解決同一連結重複下載。已新增 src/main/mediaCache.ts，並接入 saveDownloaded：按 YouTube ID、相同影音模式尋找舊專案來源，stat 及 ffprobe 可讀片長後直接引用；每次另建專案，不複製素材、不刪舊檔。讀標題仍連網。256 項離線測試、TypeScript、diff 檢查通過；本機短連結 BFSmN6fQ_04 命中 yt-3d628d/source.webm、217408ms，沒有下載。詳見 dev-plan 最新紀錄。待使用者重開開發版驗證相同連結不再下載且預覽正常；未 commit、未打包、未 push。exass/ 不動。

## 2026-10-30 本步驗收通過

使用者明確回覆「已經正常運作了，沒有白畫面。」YouTube 工具、Cookies 讀取及開發版白畫面修正驗收通過。237 項測試、TypeScript 通過，連線讀取已成功。提交訊息「修正 YouTube 工具與 Cookies 讀取及開發版白畫面」。Cookies、tools/、影音、建置產物、exass/ 不入提交；未打包、未推送。R01–R11 審查事項維持原狀。下面的待驗描述屬歷史紀錄。

## 2026-10-30 衝突整合與本機核對

本輪開始 master 與 origin/master 同為 `1b2acd9`，已 fetch 確認；沒有 rebase，兩份文件是 stash apply 衝突。stash `ee0c97bbf2acba9d1085cd2655089342b80fe6f9` 保留，另有本機暫存備份。遠端審查報告完整保留。

目前產品工作仍是 YouTube 工具、Cookies 與開發版白畫面修正，待使用者驗收；程式、測試及相關文件修改保留本機，不以存檔名義提交。這次只提交交接與計劃的衝突整理，不標記產品步驟完成。

本機仍有 R01–R09 原問題路徑；雲端未提交修正沒有在目前工作樹找到。R05 僅有使用者確認通過的背景證據，本機程式未對應，不能標成已修正。R10／R11 未開始。詳見 dev-plan 的逐項核對。

本輪 237／237 測試、typecheck、build 通過；測試包含未追蹤的 media.test.ts。YouTube 217 秒／標題／格式成功僅屬先前連線紀錄，未找到完整下載進預覽的驗收證據。白畫面 IPv4／strictPort 修改保留。

## 2026-10-29 審查補充

使用者要求分析核心邏輯及 UI，並將詳細報告同步到 GitHub。報告在 [docs/review-2026-10-29.md](docs/review-2026-10-29.md)，審查基準為 `dc84657`。列出 11 項問題及驗收條件，優先處理保存可靠性和匯出檔案保護。這次只提交文件，未修正問題，未把任何產品里程碑標成完成。下方保留先前交接內容。

2026-10-03。新對話先讀這份，再讀 `AGENTS.md`。進度以 `docs/dev-plan.md` 為準，坑以 `docs/pitfalls.md` 為準。不要靠上一段聊天。

## 以下為先前交接紀錄（當時結果，並非本輪重驗）

舊程序編號、瀏覽器狀態及「尚未解決登入」均只代表當時狀態；以本頁最新核對及 dev-plan 為準。

### 白畫面修正紀錄

renderer.server 已設 host 127.0.0.1、strictPort true，解決原先 localhost 只監聽 IPv6 的連線問題。重開後 HTTP 200，已從新 Electron 視窗無障礙樹確認完整介面、網址 http://127.0.0.1:5173/。237 項測試及 TypeScript 通過。代理開的新版本保持運行（exec session 4953），另有舊白畫面視窗，未強制關閉。等使用者驗證本步，未 commit、未打包。

## 開發版啟動補充

使用者報 Electron uninstall；已執行 node node_modules/electron/install.js 補回本機 Electron 44.4.5 執行檔，require('electron') 正常。代理代開時 Electron 已啟動，但 localhost:5173 報 ERR_CONNECTION_REFUSED；未確認畫面正常，請使用者由自己的 PowerShell 重試 npm run dev。沒有改啟動設定、未打包。

## 本機 Cookies 最新狀態

使用者新增的 cookies.txt 是 JSON，已本機轉換至 studio-data/cookies.txt，原檔移至 studio-data/cookies.source.json，均忽略、不顯示內容。已接入 YouTube 資料讀取及下載，離線測試 237 項、TypeScript 通過。使用者其後明確同意用 Cookies 向 YouTube 測試，連線已成功：BFSmN6fQ_04 標題、217 秒片長及 33 個影音格式均讀到；以程式實際參數重試亦成功。沒有下載影片。等使用者用 npm run dev 人手確認讀取及下載進預覽，通過後才提交本步。未 commit、未打包。

### 2026-10-30 Cookies 匯出歷史結果

使用者已自行退出 Chrome，確認程序為 0。獨立版 yt-dlp 在沙盒內外嘗試本機匯出 Default Cookies 均報 Failed to decrypt with DPAPI；未產生 Cookies 檔，未上傳，未改保護或設定。鎖檔已解除，但解密仍失敗。詳見 dev-plan 最新紀錄；未 commit。

### 2026-10-30 工具診斷歷史交接

目前只做 YouTube 工具及登入讀取診斷，待人手驗證；詳情在 docs/dev-plan.md 最新紀錄。已確認 Chrome Default Cookies 被鎖住，PATH 的 Hermes yt-dlp 啟動器指向失效 Python。已下載並核對官方獨立版 2026.10.26 到 tools/（忽略、不提交），主程序優先使用此工具，並顯示具體失敗原因。230 項測試、TypeScript 通過。

使用者連結 BFSmN6fQ_04 不帶 Cookies 只讀資料，YouTube 要求登入確認非機械人；尚未解決登入。沒有關瀏覽器、清設定、讀 Cookie 內容或上傳 Cookies。若繼續 Chrome 診斷，需等使用者自行儲存工作並完整退出 Chrome；關閉後亦可能有 DPAPI 解密限制，不停用保護。未 commit、未打包。原本文件整理和 exass/ 保留。

以下為先前交接，其中「沒有進行中的一步」係舊狀態。

## 現在停在哪

公開倉庫：https://github.com/pxxpkm/lyric-video （public，`master`）。

歷史 GitHub 尖端是 `dc84657`，訊息 `標記播放減輕重畫已推上 GitHub`。最新程式提交是 `4980d86`，訊息 `播放中字停住就唔重畫`。`package.json` 仍是 `0.5.0`。安裝檔仍是 `release\LyricVideo Setup 0.0.0.exe`。`release/` 不進 git。沒叫打包就不要 `npm run dist`。`exass/` 未追蹤，不要提交。

M0 至 M8、0.6 至 0.15，同後面的修正，都已完成並已 push。【歷史狀態，現已由本機 YouTube 待驗工作取代】當時沒有進行中的一步。使用者話程式尚算完整，改善之處未逐條列完。下一項先改 `docs/dev-plan.md`，從「改善空間」移入，再開工。

**播放減輕重畫已完成，已 push。** 使用者話「播放已經減輕GPU用量」。字停住就唔再每幀清歌詞畫布。淡入、飛入、放大、擺正、變色、裝飾大約每 33 毫秒畫一次。暫停同播完畫一幀就停。測試 223 項通過。冇再報一個新百分比。

0.6 到 0.15 是第 6 步到第 15 步。0.10、0.11、0.12、0.13、0.14、0.15 排在 0.9 之後。不要當成小數，也不要按字串排序。

`0144858` 是 beta 0.5，已包含 M8。使用者沒有親口說「M8 可以」。不要為了補這句話再提交一次。提交對照同 0.15 之後的收貨，在 `docs/dev-plan.md` 的「現在做到哪」。

這次把交接同開發計劃收成同一份狀態，尚未提交。

## 不要自行再開

- 矢量光團、自由文字、位置移動動畫、手繪關鍵幀、第二條像素匯出、Whisper、播放清單、Mac／Linux。
- 直排成片間距預設 −2。使用者話差不多了。預覽用的字級步進不要改。
- 柔邊寫低 0 先至關閉。缺了程度、又開過柔邊，先至是 1.5。不要把 0 做成 zod 預設。
- 裙邊預設仍然是 6。
- 兩頁「文字」「外形」保持掛住，用 `.pane.off` 收起。
- 未按匯出不產生 MP4。

## 寫程式前要對的文件

- 已收貨、不要改回的時機畫面，以及各步範圍：`docs/dev-plan.md`。
- 匯出暫存檔名、字體路徑含空格、拖時間要按位元組範圍讀媒體、暫停同播放的重畫：`docs/pitfalls.md` 最上面。

## 怎麼打開

PowerShell 路徑有空格，必須加引號：

```powershell
cd "C:\Users\Leo\Lyric Video"
npm run dev
```

Git 只在這個資料夾做。這部電腦沒有 git 作者設定，不要執行 `git config`。提交時用環境變數帶 `LeoP` / `182622846+pxxpkm@users.noreply.github.com`。不要碰 `C:\` 那個被 Git 當成儲存庫的目錄。遠端是 `origin`。不要 force push。
