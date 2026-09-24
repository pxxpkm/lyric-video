import { contextBridge, ipcRenderer, webUtils } from "electron";

contextBridge.exposeInMainWorld("lyric", {
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  probeUrl: (url: string, fields: unknown) => ipcRenderer.invoke("import:probe-url", url, fields),
  probeFile: (filePath: string, fields: unknown) => ipcRenderer.invoke("import:probe-file", filePath, fields),
  downloadUrl: (url: string, request: unknown) => ipcRenderer.invoke("import:download-url", url, request),
  saveFile: (filePath: string, request: unknown) => ipcRenderer.invoke("import:save-file", filePath, request),
  createTestClip: () => ipcRenderer.invoke("preview:test-clip"),
  onProgress: (callback: (text: string) => void) => {
    const listener = (_event: unknown, text: string) => callback(text);
    ipcRenderer.on("import:progress", listener);
    return () => ipcRenderer.removeListener("import:progress", listener);
  },
});
