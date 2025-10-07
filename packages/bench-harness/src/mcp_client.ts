import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

export type McpCallArgs = {
  name: string;
  arguments?: unknown;
};

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: unknown;
};

type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
};

export class BenchMcpClient {
  private proc: ChildProcess;
  private buffer = "";
  private inflight = new Map<string, (res: JsonRpcResponse) => void>();
  private closed: Promise<void>;
  private disposed = false;

  constructor(
    cmd = process.env.MCP_BENCH_CMD ?? process.env.MCP_CMD ?? "mcp-server",
    args: string[] = [],
  ) {
    const sandboxRoot =
      process.env.MCP_SANDBOX_ROOT ?? resolve(process.cwd(), "sandbox/bench");
    this.proc = spawn(cmd, args, {
      stdio: ["pipe", "pipe", "inherit"],
      env: { ...process.env, MCP_SANDBOX_ROOT: sandboxRoot },
    });
    const stdout = this.proc.stdout;
    if (!stdout) throw new Error("MCP server stdout not available");
    stdout.setEncoding("utf8");
    stdout.on("data", (chunk: string) => {
      this.buffer += chunk;
      let idx;
      while ((idx = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, idx);
        this.buffer = this.buffer.slice(idx + 1);
        this.handleLine(line.trim());
      }
    });
    this.closed = once(this.proc, "exit").then(([code, signal]) => {
      const message = `MCP server exited (code=${code ?? ""}, signal=${signal ?? ""})`;
      for (const [, cb] of this.inflight.entries()) {
        cb({ jsonrpc: "2.0", id: null, error: { code: -32000, message } });
      }
      this.inflight.clear();
    });
  }

  private handleLine(line: string) {
    if (!line) return;
    try {
      const msg = JSON.parse(line) as JsonRpcResponse;
      const cb = msg.id != null ? this.inflight.get(String(msg.id)) : undefined;
      if (cb) {
        this.inflight.delete(String(msg.id));
        cb(msg);
      }
    } catch (err) {
      // ignore parse errors from stdout noise
    }
  }

  private rpc(method: string, params?: unknown): Promise<unknown> {
    if (this.disposed) return Promise.reject(new Error("MCP client disposed"));
    const id = randomUUID();
    const request: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolvePromise, rejectPromise) => {
      this.inflight.set(id, (msg) => {
        if (msg.error) {
          rejectPromise(new Error(`${msg.error.code} ${msg.error.message}`));
          return;
        }
        resolvePromise(msg.result);
      });
      const stdin = this.proc.stdin;
      if (!stdin) {
        this.inflight.delete(id);
        rejectPromise(new Error("MCP server stdin not available"));
        return;
      }
      stdin.write(JSON.stringify(request) + "\n");
    });
  }

  async listTools() {
    return this.rpc("tools/list");
  }

  async callTool(name: string, args: unknown) {
    return this.rpc("tools/call", { name, arguments: args });
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.proc.stdin?.end();
    this.proc.kill();
    await this.closed;
  }
}
