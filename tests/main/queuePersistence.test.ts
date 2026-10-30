import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("electron", () => ({ BrowserWindow: { getAllWindows: () => [] } }));
vi.mock("../../src/main/matchLyrics", () => ({ pendingPick: vi.fn(), matchProject: vi.fn() }));
import { pendingPick } from "../../src/main/matchLyrics";
import { enqueueTest, listJobs, openJob } from "../../src/main/queue";
import { savePreviewTiming } from "../../src/main/testClip";
import { setRoots } from "../../src/main/paths";
import { timingFromProject } from "../../src/core/projectTiming";

const roots: string[] = [];
afterEach(async () => {
  vi.resetAllMocks();
  setRoots({ studio: () => join(process.cwd(), "studio-data"), resources: () => process.cwd() });
  for (const path of roots.splice(0)) await rm(path, { recursive: true, force: true });
});

it("編輯後佇列連續重開三次讀到最新檔案，不重用 session 快照", async () => {
  const root = await mkdtemp(join(tmpdir(), "lyric-queue-"));
  roots.push(root);
  setRoots({ studio: () => root, resources: () => process.cwd() });
  const original = await enqueueTest();
  const job = listJobs().at(-1)!;
  const timing = timingFromProject(original.timing);
  timing.offsetMs = 1250;
  const save = savePreviewTiming(original.projectPath, timing, { ...original.look, size: 77 });
  const first = await openJob(job.id);
  await save;
  expect(first?.session.timing.offsetMs).toBe(1250);
  for (let i = 0; i < 3; i++) {
    const reopened = await openJob(job.id);
    expect(reopened?.session.look.size).toBe(77);
    expect(reopened?.session.timing.offsetMs).toBe(1250);
  }
  expect(original.timing.offsetMs).toBe(0);
});

it("已完成選詞後重開不再沿用舊 pick", async () => {
  const root = await mkdtemp(join(tmpdir(), "lyric-queue-"));
  roots.push(root);
  setRoots({ studio: () => root, resources: () => process.cwd() });
  await enqueueTest();
  const id = listJobs().at(-1)!.id;
  vi.mocked(pendingPick).mockReturnValue({ title: "歌", artist: "歌手", durationMs: 10000, reason: "揀歌詞", hits: [] });
  expect((await openJob(id))?.kind).toBe("pick");
  vi.mocked(pendingPick).mockReturnValue(undefined);
  expect((await openJob(id))?.kind).toBe("preview");
});
