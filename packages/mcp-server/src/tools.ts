import { z } from "zod";
import {
  writeFileDirect,
  readFileDirect,
  rmFileDirect,
  httpGetJSON,
  httpGetArrayBuffer,
} from "@proj/dta-impl";
import { resolveSandbox } from "./sandbox.js";

export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolInputError";
  }
}

export const toolSchemas = {
  write_file: {
    name: "write_file",
    description: "Write a UTF-8 text file in the sandbox.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path under sandbox, e.g. 'note.txt'",
        },
        data: {
          type: "string",
          description: "UTF-8 file contents",
        },
      },
      required: ["path", "data"],
      additionalProperties: false,
    },
    schema: z.object({
      path: z.string(),
      data: z.string(),
    }),
  },
  read_file: {
    name: "read_file",
    description: "Read a UTF-8 file from the sandbox.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path under sandbox",
        },
      },
      required: ["path"],
      additionalProperties: false,
    },
    schema: z.object({
      path: z.string(),
    }),
  },
  remove_file: {
    name: "remove_file",
    description: "Remove a file from the sandbox.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path under sandbox",
        },
      },
      required: ["path"],
      additionalProperties: false,
    },
    schema: z.object({
      path: z.string(),
    }),
  },
  http_get_json: {
    name: "http_get_json",
    description: "HTTP GET expecting JSON.",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          format: "uri",
          description: "Absolute URL",
        },
      },
      required: ["url"],
      additionalProperties: false,
    },
    schema: z.object({
      url: z.string().url(),
    }),
  },
  http_get_blob: {
    name: "http_get_blob",
    description: "HTTP GET returning binary size.",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          format: "uri",
          description: "Absolute URL",
        },
      },
      required: ["url"],
      additionalProperties: false,
    },
    schema: z.object({
      url: z.string().url(),
    }),
  },
} as const;

export type ToolName = keyof typeof toolSchemas;

type InferSchema<T extends ToolName> = z.infer<(typeof toolSchemas)[T]["schema"]>;

export function listTools() {
  return Object.values(toolSchemas).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));
}

export function validate<T extends ToolName>(name: T, args: unknown): InferSchema<T> {
  const def = toolSchemas[name];
  if (!def) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return def.schema.parse(args);
}

type ToolContext = {
  sandboxRoot: string;
};

const handlers = {
  async write_file(args: InferSchema<"write_file">, ctx: ToolContext) {
    const path = resolveSandbox(ctx.sandboxRoot, args.path);
    await writeFileDirect(path, args.data);
    return {
      ok: true,
      path,
      bytes: Buffer.byteLength(args.data, "utf8"),
    };
  },
  async read_file(args: InferSchema<"read_file">, ctx: ToolContext) {
    const path = resolveSandbox(ctx.sandboxRoot, args.path);
    const buf = await readFileDirect(path);
    return {
      ok: true,
      path,
      data: buf.toString("utf8"),
    };
  },
  async remove_file(args: InferSchema<"remove_file">, ctx: ToolContext) {
    const path = resolveSandbox(ctx.sandboxRoot, args.path);
    await rmFileDirect(path);
    return {
      ok: true,
      path,
    };
  },
  async http_get_json(args: InferSchema<"http_get_json">, _ctx: ToolContext) {
    const url = new URL(args.url);
    if (!isHttpProtocol(url.protocol)) {
      throw new ToolInputError(`Unsupported URL protocol: ${url.protocol || "unknown"}`);
    }
    const json = await httpGetJSON(url.toString());
    return {
      ok: true,
      url: url.toString(),
      json,
    };
  },
  async http_get_blob(args: InferSchema<"http_get_blob">, _ctx: ToolContext) {
    const url = new URL(args.url);
    if (!isHttpProtocol(url.protocol)) {
      throw new ToolInputError(`Unsupported URL protocol: ${url.protocol || "unknown"}`);
    }
    const buffer = await httpGetArrayBuffer(url.toString());
    return {
      ok: true,
      url: url.toString(),
      bytes: buffer.byteLength,
    };
  },
} satisfies {
  [K in ToolName]: (args: InferSchema<K>, ctx: ToolContext) => Promise<any>;
};

export async function executeTool<T extends ToolName>(
  name: T,
  args: InferSchema<T>,
  ctx: ToolContext,
) {
  const handler = handlers[name] as (args: InferSchema<T>, ctx: ToolContext) => Promise<any>;
  return handler(args, ctx);
}

export function isToolName(name: string): name is ToolName {
  return Object.prototype.hasOwnProperty.call(toolSchemas, name);
}

function isHttpProtocol(protocol: string) {
  return protocol === "http:" || protocol === "https:";
}
