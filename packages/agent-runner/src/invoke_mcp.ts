// src/invoke_mcp.ts
import { spawn } from "node:child_process";
import type { ToolInvoker } from "./invoke.js";

type JsonRpcReq = { jsonrpc: "2.0"; id: string; method: string; params?: any };
type JsonRpcRes = { jsonrpc: "2.0"; id: string; result?: any; error?: { code: number; message: string; data?: any } };

export class MCPInvoker implements ToolInvoker {
  private proc;
  private inflight = new Map<string, (res: JsonRpcRes) => void>();
  private buf = "";

  constructor(cmd = process.env.MCP_CMD ?? "node", args = (process.env.MCP_ARGS ?? "").split(" ").filter(Boolean)) {
    this.proc = spawn(cmd, args, { stdio: ["pipe", "pipe", "inherit"] });
    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk) => {
      this.buf += chunk;
      let idx;
      while ((idx = this.buf.indexOf("\n")) >= 0) {
        const line = this.buf.slice(0, idx); this.buf = this.buf.slice(idx + 1);
        if (!line.trim()) continue;
        const msg = JSON.parse(line) as JsonRpcRes;
        const cb = this.inflight.get(msg.id);
        if (cb) { this.inflight.delete(msg.id); cb(msg); }
      }
    });
  }

  private rpc(method: string, params?: any): Promise<any> {
    const id = Math.random().toString(36).slice(2);
    const req: JsonRpcReq = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      this.inflight.set(id, (msg) => {
        if (msg.error) reject(new Error(`${msg.error.code} ${msg.error.message}`));
        else resolve(msg.result);
      });
      this.proc.stdin.write(JSON.stringify(req) + "\n");
    });
  }

  async listTools() {
    return this.rpc("tools/list");
  }

  async invoke(name: string, args: any) {
    return this.rpc("tools/call", { name, arguments: args });
  }
}

export const mcpInvoker = new MCPInvoker();
