import { AsyncLocalStorage } from "node:async_hooks";

const context = new AsyncLocalStorage<AbortSignal>();
const active = new Map<string, AbortController>();

export function currentToolSignal(): AbortSignal | undefined { return context.getStore(); }
export function throwIfToolCancelled(): void {
  if (currentToolSignal()?.aborted) throw new Error("已取消工作，可以重試。");
}
export function toolOperationsBusy(): boolean { return active.size > 0; }
export function cancelAllToolOperations(): void { for (const controller of active.values()) controller.abort(); }
export function cancelToolOperation(key: string): boolean {
  const controller = active.get(key);
  controller?.abort();
  return controller != null;
}
export async function runToolOperation<T>(key: string, task: () => Promise<T>): Promise<T> {
  if (active.has(key)) throw new Error("同一工作仍在處理或取消中，請稍候。");
  const controller = new AbortController();
  active.set(key, controller);
  try { return await context.run(controller.signal, task); }
  finally { active.delete(key); }
}
