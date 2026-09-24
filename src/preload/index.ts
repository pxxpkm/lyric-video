import { contextBridge, ipcRenderer, webUtils } from "electron";

contextBridge.exposeInMainWorld("lyric", {
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  probeUrl: (url: string, fields: unknown) => ipcRenderer.invoke("import:probe-url", url, fields),
  probeFile: (filePath: string, fields: unknown) => ipcRenderer.invoke("import:probe-file", filePath, fields),
  downloadUrl: (url: string, request: unknown) => ipcRenderer.invoke("import:download-url", url, request),
  saveFile: (filePath: string, request: unknown) => ipcRenderer.invoke("import:save-file", filePath, request),
  createTestClip: () => ipcRenderer.invoke("preview:test-clip"),
  loadProject: (projectPath: string) => ipcRenderer.invoke("preview:load", projectPath),
  saveTiming: (projectPath: string, timing: unknown) => ipcRenderer.invoke("preview:save", projectPath, timing),
  exportVideo: (request: unknown) => ipcRenderer.invoke("export:video", request),
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
