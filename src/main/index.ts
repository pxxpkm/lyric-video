import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { ensureLogDir } from "./log";

function createWindow(): void {
  const win = new BrowserWindow({
    width: 960,
    height: 640,
    show: false,
    title: "歌詞影片",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.on("ready-to-show", () => win.show());

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  try {
    await ensureLogDir();
  } catch (error) {
    console.error(error);
  }
  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
