import { BrowserWindow } from "electron";
import { randomBytes } from "node:crypto";
import { describeUrl, saveDownloaded, saveLocal } from "./importService";
import { createTestClip } from "./testClip";
import type { PreviewSession } from "../shared/preview";

export type QueueJob = {
  id: string;
  label: string;
  status: "waiting" | "running" | "ready" | "failed";
  message: string;
  projectPath?: string;
  session?: PreviewSession;
};

const jobs: QueueJob[] = [];
let pumping = false;

function publish(): void {
  const snapshot = jobs.map(({ session: _session, ...job }) => job);
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send("queue:update", snapshot);
}

export function listJobs(): Omit<QueueJob, "session">[] {
  return jobs.map(({ session: _session, ...job }) => job);
}

export function enqueueUrls(text: string): void {
  for (const line of text.split(/\r?\n/)) {
    const url = line.trim();
    if (!/^https?:\/\//i.test(url)) continue;
    jobs.push({ id: newId(), label: url, status: "waiting", message: "等候" });
  }
  publish();
  void pump();
}

export function enqueueFile(filePath: string): void {
  const trimmed = filePath.trim();
  if (!trimmed) return;
  jobs.push({ id: newId(), label: trimmed, status: "waiting", message: "等候" });
  publish();
  void pump();
}

export async function enqueueTest(): Promise<PreviewSession> {
  const job: QueueJob = { id: newId(), label: "測試片", status: "running", message: "正在準備" };
  jobs.push(job);
  publish();
  try {
    const session = await createTestClip();
    job.status = "ready";
    job.message = "可預覽";
    job.projectPath = session.projectPath;
    job.session = session;
    publish();
    return session;
  } catch (error) {
    job.status = "failed";
    job.message = error instanceof Error ? error.message : "失敗";
    publish();
    throw error;
  }
}

export function jobSession(id: string): PreviewSession | null {
  return jobs.find((job) => job.id === id)?.session ?? null;
}

async function pump(): Promise<void> {
  if (pumping) return;
  const next = jobs.find((job) => job.status === "waiting" && job.label.startsWith("http"));
  const fileJob = jobs.find((job) => job.status === "waiting" && !job.label.startsWith("http") && job.label !== "測試片");
  const job = next ?? fileJob;
  if (!job) return;
  pumping = true;
  job.status = "running";
  job.message = "處理中";
  publish();
  try {
    if (job.label.startsWith("http")) {
      const probed = await describeUrl(job.label, { lockTitle: false, lockArtist: false, title: "", artist: "" });
      if (!probed.ok) throw new Error(probed.error);
      const saved = await saveDownloaded(job.label, {
        title: probed.draft.title,
        artist: probed.draft.artist,
        durationMs: probed.draft.durationMs,
        mode: probed.draft.mode,
        lockTitle: false,
        lockArtist: false,
      });
      if (!saved.ok) throw new Error(saved.error);
      const { loadPreview } = await import("./testClip");
      job.session = loadPreview(saved.projectPath);
      job.projectPath = saved.projectPath;
      job.label = probed.draft.title || job.label;
    } else {
      const described = await describeFileSafe(job.label);
      const saved = await saveLocal(job.label, {
        title: described?.title ?? "",
        artist: described?.artist ?? "",
        durationMs: described?.durationMs ?? 0,
        mode: described?.mode ?? "video",
        lockTitle: false,
        lockArtist: false,
      });
      if (!saved.ok) throw new Error(saved.error);
      const { loadPreview } = await import("./testClip");
      job.session = loadPreview(saved.projectPath);
      job.projectPath = saved.projectPath;
      job.label = job.session.title || job.label;
    }
    job.status = "ready";
    job.message = "可預覽，尚未匯出";
  } catch (error) {
    job.status = "failed";
    job.message = error instanceof Error ? error.message : "失敗";
  }
  pumping = false;
  publish();
  void pump();
}

async function describeFileSafe(filePath: string) {
  const { describeFile } = await import("./importService");
  const result = await describeFile(filePath, { lockTitle: false, lockArtist: false, title: "", artist: "" });
  return result.ok ? result.draft : null;
}

function newId(): string {
  return randomBytes(4).toString("hex");
}
