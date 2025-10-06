import { PassThrough, Writable } from "node:stream";
import { createInterface, type Interface } from "node:readline";
import { mkdtemp, readFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startServer, type ServerHandle, type JsonRpcResponse } from "./server.js";

class NullWritable extends Writable {
  _write(_chunk: any, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    callback();
  }
}

describe("mcp-server stdio loop", () => {
  let sandboxRoot: string;
  let prevSandboxEnv: string | undefined;
  let input: PassThrough;
  let output: PassThrough;
  let rl: Interface;
  let handle: ServerHandle;

  beforeEach(async () => {
    sandboxRoot = await mkdtemp(join(tmpdir(), "mcp-stdio-"));
    prevSandboxEnv = process.env.MCP_SANDBOX_ROOT;
    process.env.MCP_SANDBOX_ROOT = sandboxRoot;

    input = new PassThrough();
    output = new PassThrough();
    output.setEncoding("utf8");
    rl = createInterface({ input: output });

    handle = await startServer({ input, output, error: new NullWritable() });
  });

  afterEach(async () => {
    rl.close();
    input.end();
    output.end();
    await handle.close();
    await rm(sandboxRoot, { recursive: true, force: true });
    if (prevSandboxEnv === undefined) delete process.env.MCP_SANDBOX_ROOT;
    else process.env.MCP_SANDBOX_ROOT = prevSandboxEnv;
  });

  function send(method: string, params: unknown, id: string) {
    const payload = { jsonrpc: "2.0", id, method, params };
    input.write(JSON.stringify(payload) + "\n");
  }

  async function read(): Promise<JsonRpcResponse> {
    const [line] = (await once(rl, "line")) as [string];
    return JSON.parse(line) as JsonRpcResponse;
  }

  it("handles write/read/remove sequence", async () => {
    send("tools/list", undefined, "1");
    const list = await read();
    const tools = (list.result as any)?.tools;
    expect(Array.isArray(tools)).toBe(true);

    send("tools/call", { name: "write_file", arguments: { path: "sample.txt", data: "hello" } }, "2");
    const writeRes = await read();
    expect((writeRes.result as any)).toMatchObject({ ok: true });

    const absPath = join(sandboxRoot, "sample.txt");
    expect(await readFile(absPath, "utf8")).toBe("hello");

    send("tools/call", { name: "read_file", arguments: { path: "sample.txt" } }, "3");
    const readRes = await read();
    expect((readRes.result as any)).toMatchObject({ data: "hello" });

    send("tools/call", { name: "remove_file", arguments: { path: "sample.txt" } }, "4");
    const rmRes = await read();
    expect((rmRes.result as any)).toMatchObject({ ok: true });
    await expect(access(absPath)).rejects.toThrow();
  });

  it("emits errors for invalid requests", async () => {
    send("unknown/method", undefined, "bad");
    const err1 = await read();
    expect(err1.error).toMatchObject({ code: -32601 });

    send("tools/call", { name: "write_file", arguments: { path: "../oops", data: "x" } }, "bad2");
    const err2 = await read();
    expect(err2.error).toMatchObject({ code: -32602 });
  });
});
