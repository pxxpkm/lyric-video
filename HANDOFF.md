# 交接

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
