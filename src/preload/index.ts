import { contextBridge, ipcRenderer, webUtils } from "electron";

contextBridge.exposeInMainWorld("lyric", {
  findSourceProjects: (source: unknown) => ipcRenderer.invoke("import:find-projects", source),
  onCloseRequest: (callback: () => Promise<boolean>) => {
    const listener = async (_event: unknown, token: string) => {
      let ok = false;
      try { ok = await callback(); } catch { /* 保存失敗時保留視窗。 */ }
      ipcRenderer.send("window:close-ready", token, ok);
    };
    ipcRenderer.on("window:request-close", listener);
    return () => ipcRenderer.removeListener("window:request-close", listener);
  },
  listCache: () => ipcRenderer.invoke("cache:list"),
  trashCache: (path: string) => ipcRenderer.invoke("cache:trash", path),
  trashAllCache: () => ipcRenderer.invoke("cache:trash-all"),
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  probeUrl: (url: string, fields: unknown) => ipcRenderer.invoke("import:probe-url", url, fields),
  probeFile: (filePath: string, fields: unknown) => ipcRenderer.invoke("import:probe-file", filePath, fields),
  downloadUrl: (url: string, request: unknown) => ipcRenderer.invoke("import:download-url", url, request),
  saveFile: (filePath: string, request: unknown) => ipcRenderer.invoke("import:save-file", filePath, request),
  createTestClip: () => ipcRenderer.invoke("preview:test-clip"),
  loadProject: (projectPath: string) => ipcRenderer.invoke("preview:load", projectPath),
  resumeProject: (projectPath: string) => ipcRenderer.invoke("preview:resume", projectPath),
  saveTiming: (projectPath: string, timing: unknown, look: unknown, motion: unknown) =>
    ipcRenderer.invoke("preview:save", projectPath, timing, look, motion),
  chironFont: () => ipcRenderer.invoke("look:chiron"),
  exportVideo: (request: unknown) => ipcRenderer.invoke("export:video", request),
  exportAss: (request: unknown) => ipcRenderer.invoke("export:ass", request),
  onExportProgress: (callback: (text: string) => void) => {
    const listener = (_event: unknown, text: string) => callback(text);
    ipcRenderer.on("export:progress", listener);
    return () => ipcRenderer.removeListener("export:progress", listener);
  },
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setShowTrans: (showTrans: boolean) => ipcRenderer.invoke("settings:set", showTrans),
  enqueueUrls: (text: string) => ipcRenderer.invoke("queue:urls", text),
  enqueueFile: (filePath: string) => ipcRenderer.invoke("queue:file", filePath),
  enqueueTest: () => ipcRenderer.invoke("queue:test"),
  openJob: (id: string) => ipcRenderer.invoke("queue:open", id),
  matchProject: (projectPath: string) => ipcRenderer.invoke("lyric:match", projectPath),
  browseProject: (projectPath: string, fields: unknown) => ipcRenderer.invoke("lyric:browse", projectPath, fields),
  useCandidate: (projectPath: string, key: string, remember: boolean) =>
    ipcRenderer.invoke("lyric:use", projectPath, key, remember),
  onQueue: (callback: (jobs: unknown) => void) => {
    const listener = (_event: unknown, jobs: unknown) => callback(jobs);
    ipcRenderer.on("queue:update", listener);
    ipcRenderer.send("queue:listen");
    return () => ipcRenderer.removeListener("queue:update", listener);
  },
  onProgress: (callback: (text: string) => void) => {
    const listener = (_event: unknown, text: string) => callback(text);
    ipcRenderer.on("import:progress", listener);
    return () => ipcRenderer.removeListener("import:progress", listener);
  },
});
