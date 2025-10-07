#!/usr/bin/env node
import readline from "node:readline";
import { dtaInvoker, dtaOllamaTools } from "../invoke_dta.js";

const MODEL = process.env.LOCAL_LLM_MODEL || "llama3.1:8b";
const BASE = process.env.LOCAL_LLM_URL || "http://host.docker.internal:11434";

type Msg = { role: "system" | "user" | "assistant" | "tool"; content: string };
type OllamaTool = {
  type: "function";
  function: { name: string; description?: string; parameters: any };
};

const systemPrompt =
  "You are a helpful assistant. Tools are available and described with JSON Schema. " +
  "When you decide to call a tool, ALWAYS include all required arguments exactly as named in the schema. " +
  "For multi-step tasks (e.g., write N files, then read them), call tools until you can answer concisely.";

const tools: OllamaTool[] = dtaOllamaTools();

async function chat(messages: Msg[]) {
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

async function runTurn(history: Msg[], user: string) {
  history.push({ role: "user", content: user });

  let resp: any = await chat(history);
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
      const result = await dtaInvoker.invoke(name, args);
      history.push({
        role: "tool",
        content: JSON.stringify({ name, args, result }),
      });
    }
    resp = await chat(history);
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
  const history: Msg[] = [{ role: "system", content: systemPrompt }];
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });
  console.log(`agent-dta-repl (model=${MODEL}). Type /bye to quit.`);
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
      await runTurn(history, input);
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
