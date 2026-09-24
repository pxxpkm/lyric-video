import { app, BrowserWindow, net, protocol } from "electron";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { appendFileSync } from "node:fs";
import { installDict } from "../core/s2t";
import { registerImportIpc } from "./ipc";
import { ensureLogDir, logDir } from "./log";
import { resourceRoot, setRoots } from "./paths";

setRoots({
  studio: () => (app.isPackaged ? join(app.getPath("userData"), "studio-data") : join(process.cwd(), "studio-data")),
  resources: () => (app.isPackaged ? process.resourcesPath : process.cwd()),
});

function loadDict(): void {
  const root = resourceRoot();
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

protocol.registerSchemesAsPrivileged([
  {
    scheme: "media",
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
  },
]);

function noteCrash(error: unknown): void {
  try {
    appendFileSync(join(logDir(), "crash.log"), `${new Date().toISOString()} ${String(error)}\n`, "utf8");
  } catch {
    /* the log directory may not exist yet */
  }
}

process.on("uncaughtException", noteCrash);
process.on("unhandledRejection", noteCrash);

registerImportIpc();

app.whenReady().then(async () => {
  protocol.handle("media", (request) => {
    const filePath = decodeURIComponent(new URL(request.url).searchParams.get("path") ?? "");
    if (!filePath || !existsSync(filePath)) return new Response("找不到檔案", { status: 404 });
    return net.fetch(pathToFileURL(filePath).href);
  });
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
