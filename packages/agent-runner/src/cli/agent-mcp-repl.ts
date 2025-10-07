#!/usr/bin/env node
import readline from "node:readline";
import { mcpInvoker } from "../invoke_mcp.js";
import { mapMcpToOllamaTools, type OllamaTool } from "../mcp_catalog.js";

const MODEL = process.env.LOCAL_LLM_MODEL || "llama3.1:8b";
const BASE = process.env.LOCAL_LLM_URL || "http://localhost:11434";

type Msg = { role: "system" | "user" | "assistant" | "tool"; content: string };

const systemPrompt =
  "You are a helpful assistant. Tools are available via a gateway. " +
  "Call tools as needed; results will be returned to you.";

async function chat(messages: Msg[], tools: OllamaTool[]) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools,
      stream: false,
      options: { temperature: 0.1 },
    }),
  });
  if (!res.ok) throw new Error(`LLM error: ${res.status}`);
  return res.json();
}

async function runTurn(history: Msg[], user: string, tools: OllamaTool[]) {
  history.push({ role: "user", content: user });

  let resp: any = await chat(history, tools);
  let msg = resp?.message ?? {};
  let tcs = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];

  while (tcs.length > 0) {
    for (const tc of tcs) {
      const name = tc?.function?.name;
      let args = tc?.function?.arguments;
      if (!name) continue;
      try {
        if (typeof args === "string") args = JSON.parse(args);
      } catch {}
      const result = await mcpInvoker.invoke(name, args);
      history.push({
        role: "tool",
        content: JSON.stringify({ name, args, result }),
      });
    }
    resp = await chat(history, tools);
    msg = resp?.message ?? {};
    tcs = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
  }

  const text = (msg?.content || "").trim();
  if (text) {
    console.log(text + "\n");
    history.push({ role: "assistant", content: text });
  }
}

async function main() {
  // 🔹 Discover tools from MCP server once at startup
  let tools: OllamaTool[] = [];
  try {
    const mcpList = await mcpInvoker.listTools();
    tools = mapMcpToOllamaTools(mcpList);
    if (!tools.length)
      console.warn("MCP server returned no tools; exposing none to the model.");
  } catch (e: any) {
    console.warn(
      "Failed to fetch MCP tool catalog; starting with no tools.",
      e?.message ?? String(e),
    );
  }

  const history: Msg[] = [{ role: "system", content: systemPrompt }];
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });
  console.log(`agent-mcp-repl (model=${MODEL}). Type /bye to quit.`);
  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) return rl.prompt();
    if (input === "/bye") {
      console.log("Bye!");
      rl.close();
      return;
    }
    rl.pause();
    try {
      await runTurn(history, input, tools);
    } catch (e: any) {
      console.error("Error:", e?.message ?? String(e));
    }
    rl.resume();
    rl.prompt();
  });
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
