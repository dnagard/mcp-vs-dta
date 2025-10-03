// src/invoke_dta.ts
import { tools, ollamaToolsFromLocal } from "./tools.js";
import type { ToolInvoker } from "./invoke.js";

export const dtaInvoker: ToolInvoker = {
  async invoke(name, args) {
    const def = (tools as any)[name];
    if (!def) throw new Error(`Unknown tool: ${name}`);
    const parsed = def.schema.parse(args);
    return def.handler(parsed);
  },
};

export function dtaOllamaTools() {
  return ollamaToolsFromLocal();
}
