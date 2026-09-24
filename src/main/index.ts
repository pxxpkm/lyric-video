import { app, BrowserWindow } from "electron";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { installDict } from "../core/s2t";
import { registerImportIpc } from "./ipc";
import { ensureLogDir } from "./log";

function loadDict(): void {
  const root = process.cwd();
  installDict(
    readFileSync(join(root, "dict/STCharacters.txt"), "utf8"),
    readFileSync(join(root, "dict/STPhrases.txt"), "utf8"),
    readFileSync(join(root, "dict/HKVariants.txt"), "utf8"),
  );
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 960,
    height: 760,
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

registerImportIpc();

app.whenReady().then(async () => {
  try {
    loadDict();
  } catch (error) {
    console.error(error);
  }
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
