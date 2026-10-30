import { expect, it, vi } from "vitest";
vi.mock("electron", () => ({ BrowserWindow: { getAllWindows: () => [] } }));
vi.mock("../../src/main/importService", () => ({ describeUrl: vi.fn(), saveDownloaded: vi.fn(), saveLocal: vi.fn() }));
vi.mock("../../src/main/matchLyrics", () => ({ matchProject: vi.fn(), pendingPick: vi.fn() }));
import { describeUrl, saveDownloaded } from "../../src/main/importService";
import { matchProject } from "../../src/main/matchLyrics";
import { cancelJob, enqueueUrls, listJobs, retryJob } from "../../src/main/queue";
import { currentToolSignal } from "../../src/main/toolOperations";

it("取消運行中／待處理工作，後續佇列繼續，取消後可重試", async () => {
  const draft = { title: "test", artist: "", durationMs: 1000, mode: "video" as const, useDuration: true, note: "" };
  let slow = true;
  vi.mocked(describeUrl).mockImplementation(async (url) => {
    if (url.endsWith("/slow") && slow) {
      const signal = currentToolSignal()!;
      await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
      return { ok: false, error: "cancelled" };
    }
    return { ok: true, draft };
  });
  vi.mocked(saveDownloaded).mockResolvedValue({ ok: true, mediaPath: "fake.mp4", projectPath: "fake.json" });
  vi.mocked(matchProject).mockResolvedValue({ kind: "preview", session: { title: "test" } } as Awaited<ReturnType<typeof matchProject>>);
  enqueueUrls("https://test.invalid/slow\nhttps://test.invalid/skipped\nhttps://test.invalid/next");
  const [first, skipped, next] = listJobs();
  cancelJob(skipped.id);
  expect(listJobs().find(job => job.id === skipped.id)?.status).toBe("cancelled");
  cancelJob(first.id);
  await expect.poll(() => listJobs().find(job => job.id === next.id)?.status).toBe("ready");
  expect(listJobs().find(job => job.id === first.id)?.status).toBe("cancelled");
  expect(saveDownloaded).toHaveBeenCalledTimes(1);
  slow = false;
  retryJob(first.id);
  await expect.poll(() => listJobs().find(job => job.id === first.id)?.status).toBe("ready");
  expect(saveDownloaded).toHaveBeenCalledTimes(2);
});

it("已建立專案但配詞失敗，重試重用同份專案而不再下載", async () => {
  vi.mocked(saveDownloaded).mockClear();
  vi.mocked(matchProject).mockRejectedValueOnce(new Error("配詞失敗"));
  enqueueUrls("https://test.invalid/retry-match");
  const job = listJobs().at(-1)!;
  await expect.poll(() => listJobs().find(item => item.id === job.id)?.status).toBe("failed");
  expect(listJobs().find(item => item.id === job.id)?.projectPath).toBe("fake.json");
  retryJob(job.id);
  await expect.poll(() => listJobs().find(item => item.id === job.id)?.status).toBe("ready");
  expect(saveDownloaded).toHaveBeenCalledTimes(1);
});
