import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { parseProject, type Project } from "../core/project";

/** 檔案系統拒絕直接替換時，先保留舊檔，失敗就挪回來。 */
async function replaceFile(dest: string, tmp: string): Promise<void> {
  try {
    await rename(tmp, dest);
    return;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST" && code !== "EPERM") throw error;
  }

  const backup = `${dest}.${randomUUID()}.bak`;
  await rename(dest, backup);
  try {
    await rename(tmp, dest);
  } catch (error) {
    try { await rename(backup, dest); }
    catch (restoreError) { throw new AggregateError([error, restoreError], `專案替換及回復失敗，舊檔保留於 ${backup}`); }
    throw error;
  }
  await rm(backup, { force: true });
}

/** 先驗證。不合法的內容不會碰到目標檔。 */
async function writeProject(path: string, project: Project): Promise<Project> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(tmp, `${JSON.stringify(project, null, 2)}\n`, "utf8");
    await replaceFile(path, tmp);
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  }
  return project;
}

const transactions = new Map<string, Promise<unknown>>();
const pathKey = (path: string) => process.platform === "win32" ? resolve(path).toLowerCase() : resolve(path);

function transaction<T>(path: string, action: () => Promise<T>): Promise<T> {
  const key = pathKey(path);
  const previous = transactions.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(action);
  transactions.set(key, next);
  const cleanup = () => { if (transactions.get(key) === next) transactions.delete(key); };
  void next.then(cleanup, cleanup);
  return next;
}

export async function waitProjectWrites(path: string): Promise<void> {
  const key = pathKey(path);
  while (transactions.has(key)) await transactions.get(key);
}

export async function waitAllProjectWrites(): Promise<void> {
  while (transactions.size > 0) await Promise.all([...transactions.values()]);
}

export async function saveProject(path: string, input: unknown): Promise<Project> {
  const project = parseProject(input);
  return transaction(path, () => writeProject(path, project));
}

// 鎖涵蓋讀取、修改及寫入，不能把鎖外讀到的舊整份專案寫回去。
export function updateProject(path: string, update: (project: Project) => Project | Promise<Project>): Promise<Project> {
  return transaction(path, async () => {
    const current = parseProject(JSON.parse(await readFile(path, "utf8")));
    const next = parseProject(await update(current));
    return writeProject(path, next);
  });
}
