// src/mcp_catalog.ts
export type OllamaTool = {
  type: "function";
  function: { name: string; description?: string; parameters: any };
};

type McpTool = {
  name: string;
  description?: string;
  input_schema?: any;
};

type McpListResult = {
  tools?: McpTool[];
};

export function mapMcpToOllamaTools(mcpListResult: McpListResult): OllamaTool[] {
  const list: McpTool[] = Array.isArray(mcpListResult?.tools) ? mcpListResult.tools : [];
  return list
    .map((t: McpTool) => ({
      type: "function" as const,
      function: {
        name: String(t?.name ?? "").trim(),
        description: typeof t?.description === "string" ? t.description : undefined,
        parameters:
          t?.input_schema && typeof t.input_schema === "object"
            ? t.input_schema
            : { type: "object", properties: {}, additionalProperties: true },
      },
    }))
    .filter((t: OllamaTool) => Boolean(t.function.name));
}
