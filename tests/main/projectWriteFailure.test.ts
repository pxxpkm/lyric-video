import { mkdtemp, readFile, readdir, rm, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof import("node:fs/promises")>();
  return { ...actual, rename: vi.fn(actual.rename) };
});
import { exampleProject } from "../../src/core/project";
import { saveProject } from "../../src/main/projectFile";

const dirs: string[] = [];
afterEach(async () => {
  vi.mocked(rename).mockReset();
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(rename).mockImplementation(actual.rename);
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

it("替換失敗會回復舊專案，不留下共用暫存檔，之後可重試", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lyric-write-failure-"));
  dirs.push(dir);
  const path = join(dir, "project.json");
  const old = exampleProject();
  old.identity.title = "舊內容";
  await saveProject(path, old);
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  let temporaryMoves = 0;
  vi.mocked(rename).mockImplementation(async (from, to) => {
    if (String(from).endsWith(".tmp")) {
      temporaryMoves++;
      throw Object.assign(new Error("rename denied"), { code: temporaryMoves === 1 ? "EPERM" : "EIO" });
    }
    return actual.rename(from, to);
  });
  const next = exampleProject();
  next.identity.title = "新內容";
  await expect(saveProject(path, next)).rejects.toThrow("rename denied");
  expect(JSON.parse(await readFile(path, "utf8")).identity.title).toBe("舊內容");
  expect(await readdir(dir)).toEqual(["project.json"]);
  vi.mocked(rename).mockImplementation(actual.rename);
  await saveProject(path, next);
  expect(JSON.parse(await readFile(path, "utf8")).identity.title).toBe("新內容");
});
