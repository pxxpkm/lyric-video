# Lyric Video

**beta 0.5**，只做 Windows 64 位元。

貼上一條音樂連結，或拖進本機影片，程式去找同步歌詞。你先在預覽裡對時間和字樣，按了「匯出 MP4」才燒成 1920×1080 的片子。沒按匯出，不會產生成片。

## 這版做得到

- 貼 YouTube 或其他 `yt-dlp` 支援的連結，也可以拖本機影音。
- 向網易雲、QQ 音樂、酷狗、LRCLIB 查同步歌詞。夠確定就直接用；不夠確定、找不到，或片長 12 分鐘以上，就打開「選擇歌詞」讓你揀。選過的可以記住。
- 歌詞裡的簡體字會轉成繁體。來源自帶的譯文可以關掉。
- 預覽可以播放、暫停、拖時間。延遲、速度、逐句微調、停留，都可以改，也會寫進該片的專案。
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

開發時，下載的影片和專案在這個資料夾的 `studio-data\`，不會進 git。

打包後的程式把專案放在 `%AppData%\lyric-video\studio-data\`。設定、記住的歌詞選擇、崩潰紀錄在 `%AppData%\LyricVideoStudio\`。

## 授權與出處

這個倉庫還沒有另立程式碼授權檔。公開之前，請先決定要給別人什麼樣的使用許可。

- 字體是昭源圓體 Chiron GoRound TC，著作權屬 [The Chiron GoRound TC Project Authors](https://github.com/chiron-fonts/chiron-go-round-tc)。
- 簡轉繁對照表是 OpenCC 的 `STCharacters.txt`、`STPhrases.txt`、`HKVariants.txt`，上游在 [BYVoid/OpenCC](https://github.com/BYVoid/OpenCC)。
- 下載用 yt-dlp，燒錄用 ffmpeg。這兩個程式各自有自己的授權。

下載來的影片和歌詞，權利在原來的作者。這個工具只幫你在自己的電腦上預覽和燒成一片，不要把成品當成可以隨意公開上傳的素材。
