# Lyric Video

**beta 0.5**，只做 Windows 64 位元。

貼上一條音樂連結，或拖進本機影片，程式去找同步歌詞。你先在預覽裡對時間和字樣，按了「匯出 MP4」才燒成 1920×1080 的片子。沒按匯出，不會產生成片。

## 這版做得到

- 貼 YouTube 或其他 `yt-dlp` 支援的連結，也可以拖本機影音。
- 向網易雲、QQ 音樂、酷狗、LRCLIB 查同步歌詞。夠確定就直接用；不夠確定、找不到，或片長 12 分鐘以上，就打開「選擇歌詞」讓你揀。選過的可以記住。
- 歌詞裡的簡體字會轉成繁體。來源自帶的譯文可以關掉。
- 預覽可以播放、暫停、拖時間。延遲、速度、逐句微調、停留，都可以改，也會寫進該片的專案。
- 預覽顯示保存狀態，返回、重選歌詞或正常關閉視窗前會等保存完成；失敗會保留修改並可重試。從佇列重開會讀取最新保存內容。
- 同一輪匯入建立後，主按鈕會變成「繼續編輯專案」，返回再按會讀取已保存修改。更改匯入設定時會顯示「建立另一份專案」；重新讀取來源則開始新一輪匯入。
- 字可以拖到想要的位置。字體、字級、顏色、唱到的顏色、裙邊，都在預覽的「字體」裡改。
- 匯出時自己選路徑。預設檔名是歌名，例如 `七里香.mp4`。
- 可以一次排幾條連結。一條做完才做下一條。只有按過匯出的那一條才有 MP4。

## 這版還沒有

- 羅馬字。開關在，但是「稍後」，不能勾。
- 播放清單、Mac、Linux。
- 安裝檔沒有把 `yt-dlp` 和 `ffmpeg` 包進去，也沒有自訂圖示。

## 使用前要先裝

這部電腦的 PATH 要找得到：

- [ffmpeg](https://ffmpeg.org/)（要連同 `ffprobe`）
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)

沒有這兩個，連結讀不到標題，也燒不出片子。讀取失敗時，可以改拖本機檔。

亦可以將官方 Windows 獨立版 `yt-dlp.exe` 放在專案的 `tools/`，程式會優先使用，避免 PATH 指向已失效的 Python 虛擬環境。請從官方 release 下載，並核對同版 `SHA2-256SUMS`。此目錄不會提交或自動打包；已安裝版仍使用 PATH，或其 `resources/tools/yt-dlp.exe`。YouTube 亦需要可用的 JavaScript runtime（例如 Deno）。

遇到 `Could not copy Chrome cookie database`，可能係 Chrome 仍鎖住 Cookies。先儲存工作，再自行完整退出 Chrome（包括背景程序）後重試；不要強制關閉。若之後報 DPAPI 解密失敗，屬另一項瀏覽器加密限制，關閉 Chrome 或更新 yt-dlp 未必解決。不要停用瀏覽器保護，亦不要上傳 Cookies；可以改拖本機影音。YouTube 要求登入或驗證時，請自行在瀏覽器處理，程式不會繞過。

如自行匯出 Netscape 格式的 Cookies，可放在 `studio-data/cookies.txt`（已安裝版用其專案資料目錄下同名檔）。有此檔案時，YouTube 連結的資料讀取及下載會以它向 YouTube 登入；其他來源不會自動帶入此檔。檔案只留本機、不會入 Git；不要分享或放入安裝包。JSON 格式的瀏覽器匯出檔需先轉換。

## 從源碼跑

需要 Node.js。

```powershell
cd "C:\路徑\Lyric Video"
npm install
npm run dev
```

| 指令 | 做什麼 |
|---|---|
| `npm test` | 跑自動測試。測試不連網。 |
| `npm run typecheck` | 檢查 TypeScript。 |
| `npm run dist` | 打出 Windows 安裝檔，在 `release\`。 |

`npm install` 之後如果打不開視窗，在專案目錄再執行一次 `node node_modules/electron/install.js`。

## 資料放在哪

同一 YouTube 影片、同一影音模式再次新增時，會先檢查本機來源，能讀取片長就重用，仍會另建獨立專案；讀取標題仍會連網。不同專案可以共用同一來源檔。

首頁「下載素材／清除緩存」可檢視大小及引用專案，並逐個或全部移至資源回收筒。確認前會列出影響；相關專案會失去來源，重新新增連結只建立新專案，不會自動修復舊專案。專案設定保留。移至資源回收筒不等於即時釋放磁碟空間。

新下載以 download-files.json 記錄來源及中間檔，清除時核對大小及修改時間；舊版只接受同資料夾 YouTube 專案明確引用的標準 source.副檔名來源檔。其他 source.* 或已變更檔案只列出並標記保留，不會由全部清除處理。沒有紀錄的舊下載殘檔亦會保留，避免將成片誤當快取。

開發時，下載的影片和專案在這個資料夾的 `studio-data\`，不會進 git。

打包後的程式把專案放在 `%AppData%\lyric-video\studio-data\`。設定、記住的歌詞選擇、崩潰紀錄在 `%AppData%\LyricVideoStudio\`。

## 授權與出處

這個倉庫還沒有另立程式碼授權檔。公開之前，請先決定要給別人什麼樣的使用許可。

- 字體是昭源圓體 Chiron GoRound TC，著作權屬 [The Chiron GoRound TC Project Authors](https://github.com/chiron-fonts/chiron-go-round-tc)。
- 簡轉繁對照表是 OpenCC 的 `STCharacters.txt`、`STPhrases.txt`、`HKVariants.txt`，上游在 [BYVoid/OpenCC](https://github.com/BYVoid/OpenCC)。
- 下載用 yt-dlp，燒錄用 ffmpeg。這兩個程式各自有自己的授權。

下載來的影片和歌詞，權利在原來的作者。這個工具只幫你在自己的電腦上預覽和燒成一片，不要把成品當成可以隨意公開上傳的素材。
