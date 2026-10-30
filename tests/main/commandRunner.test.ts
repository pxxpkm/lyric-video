import { expect, it } from "vitest";
import { runCommand } from "../../src/main/commandRunner";
import { cancelToolOperation, runToolOperation, toolOperationsBusy } from "../../src/main/toolOperations";

const node = (script: string) => ["-e", script];

it("正常結束保留 stdout、stderr 及 Unicode", async () => {
  const result = await runCommand(process.execPath, node("process.stdout.write('歌詞');process.stderr.write('提示')"));
  expect(result).toMatchObject({ code: 0, stdout: "歌詞", stderr: "提示" });
  expect(result.reason).toBeUndefined();
});

it("預先取消不啟動工具", async () => {
  const controller = new AbortController(); controller.abort();
  expect(await runCommand("tool-that-does-not-exist", [], undefined, undefined, { signal: controller.signal })).toMatchObject({ reason: "cancelled", code: -1 });
});

it("取消等待程序後可重試同一工作，其他工作識別不會誤取消", async () => {
  const result = await runToolOperation("runner:test", () => runCommand(process.execPath, node("console.log('READY');setInterval(()=>{},1000)"), () => {
    expect(cancelToolOperation("runner:other")).toBe(false);
    expect(cancelToolOperation("runner:test")).toBe(true);
  }));
  expect(result.reason).toBe("cancelled");
  expect(toolOperationsBusy()).toBe(false);
  expect((await runToolOperation("runner:test", () => runCommand(process.execPath, node("process.stdout.write('retry')")))).stdout).toBe("retry");
}, 15000);

it("逾時會真正結束工具", async () => {
  const result = await runCommand(process.execPath, node("setInterval(()=>{},1000)"), undefined, undefined, { timeoutMs: 150 });
  expect(result.reason).toBe("timeout");
  expect(result.code).toBe(-1);
}, 15000);

it("JSON 類完整輸出超限停止，緩衝不超過上限", async () => {
  const result = await runCommand(process.execPath, node("process.stdout.write('x'.repeat(200000));setInterval(()=>{},1000)"), undefined, undefined, { maxOutputBytes: 1024 });
  expect(result.reason).toBe("output-limit");
  expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(1024);
}, 15000);

it("長工具只保留尾段，不因正常進度很多而失敗", async () => {
  const result = await runCommand(process.execPath, node("process.stdout.write('x'.repeat(200000)+'\\nFILE:result.mp4');process.stderr.write('y'.repeat(200000)+'TAIL')"), undefined, undefined, { maxOutputBytes: 4096, stdoutMode: "tail" });
  expect(result.code).toBe(0);
  expect(result.truncated).toBe(true);
  expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(4096);
  expect(Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(4096);
  expect(result.stdout.endsWith("FILE:result.mp4")).toBe(true);
  expect(result.stderr.endsWith("TAIL")).toBe(true);
});

it("啟動失敗會結束，不等待逾時計時", async () => {
  expect(await runCommand("lyric-tool-that-does-not-exist", [])).toMatchObject({ code: -1, reason: "spawn-error" });
});

it.runIf(process.platform === "win32")("Windows 取消亦結束工具啟動的子程序", async () => {
  const controller = new AbortController();
  let output = "";
  const script = "const {spawn}=require('child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true});console.log('CHILD:'+child.pid);setInterval(()=>{},1000)";
  const result = await runCommand(process.execPath, node(script), (text) => {
    output += text;
    if (/CHILD:\d+/.test(output)) controller.abort();
  }, undefined, { signal: controller.signal });
  expect(result.reason).toBe("cancelled");
  const pid = Number(/CHILD:(\d+)/.exec(output)![1]);
  expect(() => process.kill(pid, 0)).toThrow();
}, 15000);
