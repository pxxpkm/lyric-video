import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { currentToolSignal } from "./toolOperations";

export type CommandReason = "cancelled" | "timeout" | "output-limit" | "spawn-error";
export type CommandResult = { code: number; stdout: string; stderr: string; reason?: CommandReason; truncated?: boolean };
export type CommandOptions = { signal?: AbortSignal; timeoutMs?: number; maxOutputBytes?: number; stdoutMode?: "full" | "tail" };

export function commandFailure(result: CommandResult): string | undefined {
  if (result.reason === "cancelled") return "已取消工作，可以重試。";
  if (result.reason === "timeout") return "工具處理逾時，已停止工作，請重試或改用本機檔。";
  if (result.reason === "output-limit") return "工具回應超出大小上限，已停止工作，請重試。";
  return undefined;
}

async function killTree(child: ChildProcess): Promise<void> {
  if (!child.pid) return;
  if (process.platform !== "win32") {
    try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
    return;
  }
  // 僅使用這次 spawn 得到的 PID，不能用程式名稱掃殺其他工作。
  await new Promise<void>((resolve) => {
    const killer = spawn(join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe"), ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    const fallback = () => { if (child.exitCode == null) child.kill(); };
    const timer = setTimeout(() => { killer.kill(); fallback(); }, 5000);
    killer.once("error", () => { clearTimeout(timer); fallback(); resolve(); });
    killer.once("close", (code) => { clearTimeout(timer); if (code !== 0) fallback(); resolve(); });
  });
}

export function runCommand(command: string, args: string[], onText?: (chunk: string) => void, cwd?: string, options: CommandOptions = {}): Promise<CommandResult> {
  const signal = options.signal ?? currentToolSignal();
  if (signal?.aborted) return Promise.resolve({ code: -1, stdout: "", stderr: "", reason: "cancelled" });
  const max = Math.max(1024, options.maxOutputBytes ?? 8 * 1024 * 1024);
  return new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true, cwd, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let reason: CommandReason | undefined;
    let truncated = false;
    let termination: Promise<void> = Promise.resolve();
    let closed = false;
    const stop = (why: CommandReason) => {
      if (reason || closed) return;
      reason = why;
      termination = killTree(child);
    };
    const abort = () => stop("cancelled");
    const timer = setTimeout(() => stop("timeout"), Math.max(1, options.timeoutMs ?? 60_000));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const receive = (chunk: Buffer, channel: "stdout" | "stderr") => {
      const old = channel === "stdout" ? stdout : stderr;
      const limit = channel === "stdout" ? max : Math.min(max, 64 * 1024);
      const combined = Buffer.concat([old, chunk]);
      const exceeded = combined.length > limit;
      const tail = channel === "stderr" || options.stdoutMode === "tail";
      const kept = exceeded ? (tail ? combined.subarray(combined.length - limit) : combined.subarray(0, limit)) : combined;
      // 複製切片，避免持續保留更大的底層 Buffer。
      if (channel === "stdout") stdout = Buffer.from(kept); else stderr = Buffer.from(kept);
      if (exceeded) { truncated = true; if (!tail) stop("output-limit"); }
      if (!reason) {
        try { onText?.(chunk.toString("utf8")); } catch { stop("cancelled"); }
      }
    };
    child.stdout.on("data", (chunk: Buffer) => receive(chunk, "stdout"));
    child.stderr.on("data", (chunk: Buffer) => receive(chunk, "stderr"));
    child.once("error", (error) => {
      reason ??= "spawn-error";
      stderr = Buffer.from(error.message).subarray(0, Math.min(max, 64 * 1024));
    });
    child.once("close", async (code) => {
      closed = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      await termination;
      resolve({ code: reason ? -1 : code ?? -1, stdout: stdout.toString("utf8"), stderr: stderr.toString("utf8"), ...(reason ? { reason } : {}), ...(truncated ? { truncated } : {}) });
    });
  });
}
