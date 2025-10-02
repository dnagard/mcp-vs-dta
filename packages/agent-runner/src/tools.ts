import { z } from "zod";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import {
  writeFileDirect, readFileDirect, rmFileDirect,
  httpGetJSON, httpGetArrayBuffer
} from "@proj/dta-impl";

const SANDBOX = resolve(process.cwd(), "sandbox");
export async function ensureSandbox() { await fs.mkdir(SANDBOX, { recursive: true }); }
const sp = (p: string) => {
  const abs = resolve(SANDBOX, p);
  if (!abs.startsWith(SANDBOX)) throw new Error("Path escapes sandbox");
  return abs;
};

// Schemas with the exact arg names we expect
const WriteFileArgs = z.object({ path: z.string(), data: z.string() });
const ReadFileArgs  = z.object({ path: z.string() });
const RemoveArgs    = z.object({ path: z.string() });
const GetJsonArgs   = z.object({ url: z.string().url() });
const GetBlobArgs   = z.object({ url: z.string().url() });

export const tools = {
  write_file: {
    description: "Write a UTF-8 text file in the sandbox.",
    args: { path: "string (relative path, e.g. 'note.txt')", data: "string" },
    schema: WriteFileArgs,
    handler: async (a: z.infer<typeof WriteFileArgs>) => {
      const p = sp(a.path); await writeFileDirect(p, a.data);
      return { ok: true, path: p, bytes: Buffer.byteLength(a.data) };
    }
  },
  read_file: {
    description: "Read a UTF-8 file from the sandbox.",
    args: { path: "string (relative path)" },
    schema: ReadFileArgs,
    handler: async (a: z.infer<typeof ReadFileArgs>) => {
      const p = sp(a.path); const buf = await readFileDirect(p);
      return { ok: true, path: p, data: buf.toString("utf8") };
    }
  },
  remove_file: {
    description: "Remove a file from the sandbox.",
    args: { path: "string (relative path)" },
    schema: RemoveArgs,
    handler: async (a: z.infer<typeof RemoveArgs>) => {
      const p = sp(a.path); await rmFileDirect(p); return { ok: true, path: p };
    }
  },
  http_get_json: {
    description: "HTTP GET expecting JSON.",
    args: { url: "string (absolute URL)" },
    schema: GetJsonArgs,
    handler: async (a: z.infer<typeof GetJsonArgs>) => {
      const json = await httpGetJSON(a.url); return { ok: true, url: a.url, json };
    }
  },
  http_get_blob: {
    description: "HTTP GET returning binary size.",
    args: { url: "string (absolute URL)" },
    schema: GetBlobArgs,
    handler: async (a: z.infer<typeof GetBlobArgs>) => {
      const ab = await httpGetArrayBuffer(a.url); return { ok: true, url: a.url, bytes: ab.byteLength };
    }
  }
} as const;

export type ToolName = keyof typeof tools;

export function toolCatalogForPrompt() {
  // Provide exact argument names/types the model must use
  return Object.entries(tools).map(([name, t]) => ({
    name,
    description: t.description,
    args: t.args
  }));
}

// Safe parse + call (we’ll allow common arg synonyms here)
export async function callTool(name: ToolName, rawArgs: any) {
  const def = (tools as any)[name];
  if (!def) throw new Error(`Unknown tool: ${name}`);

  // normalize common synonyms from LLMs
  if (name === "write_file") {
    if (rawArgs?.filename && !rawArgs?.path) { rawArgs.path = rawArgs.filename; delete rawArgs.filename; }
    if (rawArgs?.content && !rawArgs?.data)  { rawArgs.data = rawArgs.content;   delete rawArgs.content; }
  } else if (name === "read_file" || name === "remove_file") {
    if (rawArgs?.filename && !rawArgs?.path) { rawArgs.path = rawArgs.filename; delete rawArgs.filename; }
  }

  const args = def.schema.parse(rawArgs);
  return def.handler(args);
}
