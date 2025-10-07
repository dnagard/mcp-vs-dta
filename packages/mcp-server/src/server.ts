import { createInterface, type Interface } from "node:readline";
import { stdin, stdout, stderr } from "node:process";
import { ZodError } from "zod";
import {
  executeTool,
  isToolName,
  listTools,
  validate,
  ToolInputError,
} from "./tools.js";
import { ensureSandboxRoot, SandboxPathError } from "./sandbox.js";

const JSONRPC_VERSION = "2.0";

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: typeof JSONRPC_VERSION;
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: typeof JSONRPC_VERSION;
  id: JsonRpcId;
  result?: unknown;
  error?: JsonRpcError;
}

function ok(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: JSONRPC_VERSION, id, result };
}

function err(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  const payload: JsonRpcResponse = {
    jsonrpc: JSONRPC_VERSION,
    id,
    error: { code, message },
  };
  if (data !== undefined) payload.error!.data = data;
  return payload;
}

function logDebug(message: string) {
  stderr.write(`[mcp-server] ${message}\n`);
}

function isValidId(id: unknown): id is JsonRpcId {
  return id === null || typeof id === "string" || typeof id === "number";
}

type StartOptions = {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  error?: NodeJS.WritableStream;
};

export interface ServerHandle {
  waitUntilClosed(): Promise<void>;
  close(): Promise<void>;
  readonly sandboxRoot: string;
}

export async function startServer(
  options: StartOptions = {},
): Promise<ServerHandle> {
  const input = options.input ?? stdin;
  const output = options.output ?? stdout;
  const error = options.error ?? stderr;
  const sandboxRoot = await ensureSandboxRoot();

  const rl: Interface = createInterface({ input, crlfDelay: Infinity });

  const send = (response: JsonRpcResponse) => {
    output.write(JSON.stringify(response) + "\n");
    if (response.error) {
      logDebug(`${response.error.code} ${response.error.message}`);
    }
  };

  const handleToolsList = async (id: JsonRpcId) => {
    const tools = listTools();
    send(ok(id, { tools }));
  };

  const handleToolsCall = async (id: JsonRpcId, params: unknown) => {
    if (!params || typeof params !== "object") {
      send(err(id, -32602, "Invalid params"));
      return;
    }

    const { name, arguments: rawArgs } = params as {
      name?: unknown;
      arguments?: unknown;
    };

    if (typeof name !== "string") {
      send(
        err(id, -32602, "Invalid params", { reason: "name must be string" }),
      );
      return;
    }

    if (!isToolName(name)) {
      send(err(id, -32601, "Method not found"));
      return;
    }

    let parsedArgs: unknown;
    try {
      parsedArgs = validate(name, rawArgs ?? {});
    } catch (e) {
      if (e instanceof ZodError) {
        send(err(id, -32602, "Invalid params", { issues: e.issues }));
        return;
      }
      send(err(id, -32602, "Invalid params"));
      return;
    }

    try {
      const result = await executeTool(name, parsedArgs as never, {
        sandboxRoot,
      });
      send(ok(id, result));
    } catch (e) {
      if (e instanceof SandboxPathError || e instanceof ToolInputError) {
        send(err(id, -32602, e.message, { name }));
        return;
      }
      const message = e instanceof Error ? e.message : "Server error";
      send(err(id, -32000, message, { name }));
    }
  };

  let current = Promise.resolve();

  const handleLine = async (rawLine: string) => {
    const trimmed = rawLine.replace(/\r$/, "").trim();
    if (trimmed.length === 0) return;

    let request: JsonRpcRequest;
    try {
      request = JSON.parse(trimmed);
    } catch (e) {
      send(err(null, -32700, "Parse error"));
      logDebug(`Parse error: ${(e as Error).message}`);
      return;
    }

    if (
      request.jsonrpc !== JSONRPC_VERSION ||
      typeof request.method !== "string"
    ) {
      const id = isValidId(request.id) ? (request.id ?? null) : null;
      send(err(id, -32600, "Invalid request"));
      return;
    }

    const id = isValidId(request.id) ? (request.id ?? null) : null;

    switch (request.method) {
      case "tools/list":
        await handleToolsList(id);
        break;
      case "tools/call":
        await handleToolsCall(id, request.params);
        break;
      default:
        send(err(id, -32601, "Method not found"));
        break;
    }
  };

  rl.on("line", (line) => {
    current = current
      .then(() => handleLine(line))
      .catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        error.write(`[mcp-server] Unexpected error: ${message}\n`);
      });
  });

  const waitUntilClosed = new Promise<void>((resolve) => {
    rl.once("close", resolve);
    input.once("close", resolve);
  });

  const close = async () => {
    rl.close();
    try {
      await current;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      error.write(`[mcp-server] Error while shutting down: ${message}\n`);
    }
  };

  return {
    sandboxRoot,
    waitUntilClosed: () => waitUntilClosed,
    close,
  };
}
