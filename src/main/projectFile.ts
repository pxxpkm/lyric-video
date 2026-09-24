import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseProject, type Project } from "../core/project";

/** Windows 的 rename 不會覆蓋已存在的檔。先挪開舊檔，失敗就挪回來。 */
async function replaceFile(dest: string, tmp: string): Promise<void> {
  try {
    await rename(tmp, dest);
    return;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST" && code !== "EPERM") throw error;
  }

  const backup = `${dest}.bak`;
  await rm(backup, { force: true });
  await rename(dest, backup);
  try {
    await rename(tmp, dest);
  } catch (error) {
    await rename(backup, dest).catch(() => undefined);
    throw error;
  }
  await rm(backup, { force: true });
}

/** 先驗證。不合法的內容不會碰到目標檔。 */
export async function saveProject(path: string, input: unknown): Promise<Project> {
  const project = parseProject(input);
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(tmp, `${JSON.stringify(project, null, 2)}\n`, "utf8");
    await replaceFile(path, tmp);
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  }
  return project;
}
