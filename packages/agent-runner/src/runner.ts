import {
  ensureSandbox,
  toolCatalogForPrompt,
  callTool,
  ToolName,
} from "./tools.js";
import { chatOllama } from "./clients/ollama.js";

function systemPrompt(catalog: any) {
  return [
    "You can call tools. Respond with JSON ONLY (no markdown, no text).",
    'Response schema: { "tool_name": "<name>", "arguments": { ... } }',
    "Use EXACT argument names shown below. Do not invent names like filename/content.",
    "Choose ONE tool and ONE JSON object (do not include multiple JSON objects).",
    "Available tools:",
    JSON.stringify(catalog, null, 2),
  ].join("\n");
}

function extractFirstJsonObject(s: string) {
  // Find the first {...} block and parse it
  const start = s.indexOf("{");
  if (start === -1) throw new Error("No JSON object found");
  // naive scan for a balanced object
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const slice = s.slice(start, i + 1);
        return JSON.parse(slice);
      }
    }
  }
  // fallback
  return JSON.parse(s);
}

async function main() {
  await ensureSandbox();
  const model = process.env.LOCAL_LLM_MODEL || "llama3.1:8b";
  const baseUrl =
    process.env.LOCAL_LLM_URL || "http://host.docker.internal:11434";
  const userTask =
    process.argv.slice(2).join(" ") ||
    "Create hello.txt with 'hi' then read it back";

  const catalog = toolCatalogForPrompt();

  const reply = await chatOllama({
    model,
    baseUrl,
    messages: [
      { role: "system", content: systemPrompt(catalog) },
      { role: "user", content: userTask },
    ],
    temperature: 0,
  });

  let parsed: { tool_name: ToolName; arguments: unknown };
  try {
    parsed = extractFirstJsonObject(reply);
  } catch {
    throw new Error("Model did not return valid JSON: " + reply);
  }

  const result = await callTool(parsed.tool_name, parsed.arguments);

  const summary = await chatOllama({
    model,
    baseUrl,
    messages: [
      {
        role: "system",
        content: "Summarize the tool result briefly as plain text.",
      },
      { role: "user", content: JSON.stringify({ tool_call: parsed, result }) },
    ],
    temperature: 0,
  });

  console.log("Tool call:", parsed);
  console.log("Result:", result);
  console.log("LLM summary:", summary.trim());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
