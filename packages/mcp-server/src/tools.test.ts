import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { listTools, validate, executeTool, ToolInputError } from "./tools.js";
import { resolveSandbox, SandboxPathError } from "./sandbox.js";

describe("tool catalog", () => {
  it("matches expected shape", () => {
    expect(listTools()).toMatchSnapshot();
  });
});

describe("filesystem tools", () => {
  let sandboxRoot: string;

  beforeEach(async () => {
    sandboxRoot = await mkdtemp(join(tmpdir(), "mcp-server-test-"));
  });

  afterEach(async () => {
    await fs.rm(sandboxRoot, { recursive: true, force: true });
  });

  it("writes, reads, and removes files", async () => {
    const path = `file-${randomUUID()}.txt`;
    await executeTool("write_file", { path, data: "hello" }, { sandboxRoot });
    const read = await executeTool("read_file", { path }, { sandboxRoot });
    expect(read).toMatchObject({ ok: true, data: "hello" });
    await executeTool("remove_file", { path }, { sandboxRoot });
    await expect(fs.access(resolveSandbox(sandboxRoot, path))).rejects.toThrow();
  });

  it("rejects sandbox escape attempts", async () => {
    await expect(
      executeTool("write_file", { path: "../../etc/passwd", data: "nope" }, { sandboxRoot })
    ).rejects.toBeInstanceOf(SandboxPathError);
  });

  it("returns IO errors for missing files", async () => {
    await expect(executeTool("read_file", { path: "missing.txt" }, { sandboxRoot })).rejects.toThrow();
  });
});

describe("http tools", () => {
  let server: http.Server;
  let urlBase: string;

  beforeEach(async () => {
    server = http.createServer((req, res) => {
      if (req.url?.startsWith("/json")) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (req.url?.startsWith("/blob")) {
        res.writeHead(200, { "content-type": "application/octet-stream" });
        res.end(Buffer.from([1, 2, 3, 4]));
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((resolvePromise) => server.listen(0, resolvePromise));
    const address = server.address();
    if (typeof address === "object" && address) {
      urlBase = `http://127.0.0.1:${address.port}`;
    } else {
      throw new Error("Failed to start test server");
    }
  });

  afterEach(async () => {
    await new Promise<void>((resolvePromise, rejectPromise) =>
      server.close((err) => (err ? rejectPromise(err) : resolvePromise()))
    );
  });

  it("fetches JSON payloads", async () => {
    const result = await executeTool(
      "http_get_json",
      { url: `${urlBase}/json` },
      { sandboxRoot: tmpdir() }
    );
    expect(result).toMatchObject({ ok: true, json: { ok: true } });
  });

  it("fetches binary payload sizes", async () => {
    const result = await executeTool(
      "http_get_blob",
      { url: `${urlBase}/blob` },
      { sandboxRoot: tmpdir() }
    );
    expect(result).toMatchObject({ ok: true, bytes: 4 });
  });

  it("rejects unsupported schemes", async () => {
    await expect(
      executeTool("http_get_json", { url: "ftp://example.com" }, { sandboxRoot: tmpdir() })
    ).rejects.toBeInstanceOf(ToolInputError);
  });
});

describe("validation", () => {
  it("surfaces zod issues for missing data", () => {
    expect(() => validate("write_file", { path: "a" } as any)).toThrow(ZodError);
  });

  it("throws on unknown tools", () => {
    expect(() => validate("does_not_exist" as any, {})).toThrow(/Unknown tool/);
  });
});
