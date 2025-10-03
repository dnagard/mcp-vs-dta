# MCP vs DTA — how this actually works (and how we’ll mirror it locally)

## What it means for ChatGPT/Claude to “support MCP”

* **MCP is a protocol** (built on **JSON-RPC 2.0**) that lets an *LLM host/runtime* discover tools from an **MCP server** and invoke them via standardized calls like `tools/list` and `tools/call`. The host passes results back into the model’s context. ([Model Context Protocol][1])
* In products like **ChatGPT (custom connectors)** and **Claude (desktop/web)**, the **runtime includes an MCP client**. The model decides *what* to call; the **MCP client** performs the JSON-RPC to the MCP server. You register your MCP server as a connector; the runtime does the wiring. ([OpenAI Help Center][2])

**Key point:** the **LLM itself doesn’t “speak MCP.”** The **host** does. The model outputs a tool choice/arguments; the **MCP client in the runtime** translates that into JSON-RPC and sends it to the MCP server, which runs the actual tool (local or remote) and returns the result. ([Model Context Protocol][1])

---

## How MCP calls look (at a glance)

* **Discover tools:** `{"jsonrpc":"2.0","id":"1","method":"tools/list"}`
* **Invoke tool:**
  `{"jsonrpc":"2.0","id":"2","method":"tools/call","params":{"name":"write_file","arguments":{"path":"sandbox/x.txt","data":"hi"}}}`
  The server replies with `result` or `error`. Transports: **stdio** or **HTTP/streaming**. ([Model Context Protocol][3])

---

## How we mirror this with **Ollama** (all local)

Ollama adds **tool/function calling**: you register tools (JSON Schemas); the model proposes calls; **your client code executes them** and feeds results back. That’s the same control loop pattern OpenAI/Anthropic use—just local. ([ollama.com][4])

Two modes we’ll support:

1. **DTA (Direct Tool Adapters) with Ollama**

   * Register our **Node tools** (e.g., `write_file`, `read_file`, `http_get_json`) directly with **Ollama Tools**.
   * The model emits tool calls; our client executes them in-process; results go back into the chat.
   * This matches “direct” tool integration in OpenAI/Anthropic function-calling. ([Mistral AI Documentation][5])

2. **MCP (via local proxy) with Ollama**

   * Still use **Ollama Tools**, but the “tool” is a **thin proxy** that forwards `name/arguments` to a **local MCP server** using JSON-RPC (`tools/call`).
   * The MCP server hosts the *real* tools and returns the results → proxy → model.
   * Architecture shape matches Claude/ChatGPT (runtime ⇄ MCP server ⇄ tools); only difference is **we** provide the MCP client/proxy because Ollama itself isn’t an MCP client. ([Model Context Protocol][6])

---

## DTA vs MCP — mental model & diagrams

**DTA (direct)**

```
Model (Ollama)
   │  emits tool call
   ▼
Client executor (our code)
   │  local function call (Node)
   ▼
Tool implementation (e.g., fs/http)
   ▲
Result → back into chat
```

**MCP (indirect, protocolized)**

```
Model (Ollama or Claude/ChatGPT)
   │  emits tool call
   ▼
MCP client (runtime or our proxy)
   │  JSON-RPC 2.0
   ▼
MCP server (local/remote)
   │  calls real tool(s)
   ▼
Tool implementation
   ▲
Result → MCP client → back into chat
```

* In **ChatGPT/Claude**, the **MCP client is built into the runtime** (no extra proxy needed). ([OpenAI Help Center][2])
* In **Ollama**, we add a tiny MCP client/proxy to achieve the same flow locally.

---

## Multiple tools: how the model selects & how we register them

**DTA (Ollama Tools):**

* We register **each tool** (schema, name) with Ollama.
* The model can emit **multiple tool calls**, even in the same turn; we execute each and return observations; the model produces the final answer. (Parallel calling is a known pattern in tool-calling runtimes.) ([Claude Docs][7])

**MCP (via proxy on Ollama):** two ways

1. **Mirror catalog:** at startup, call `tools/list` on the MCP server and **register each tool as an Ollama tool** (same names/schemas). When the model calls one, our executor forwards to MCP `tools/call`.
2. **Generic proxy tool:** expose one Ollama tool like `mcp_call(name, arguments)`. The model passes the target tool name; our proxy performs `tools/call`.
   Either approach maintains behavior parity with Claude/ChatGPT’s MCP client. ([Model Context Protocol][3])

**MCP (native in ChatGPT/Claude):**

* The runtime’s MCP client does discovery (`tools/list`) and presents tools to the model internally; when the model chooses tools, the runtime performs the JSON-RPC to the MCP server. ([Claude Docs][8])

---

## Model choice (local, good at tool calling)

If you move off `llama3.2`, pick a small, tool-calling-friendly instruct model so your 3070 can run it comfortably:

* **Qwen 2.5 7B Instruct** — strong function-calling templates; supported with Ollama given correct templates. ([Qwen][9])
* **Llama 3.1 8B Instruct** — explicitly highlighted by Ollama for tool calling. ([ollama.com][4])
* (Mistral-class 7B instruct models also support function calling via similar APIs.) ([Mistral AI Documentation][5])

These give you reliable structured outputs for tool selection while staying feasible locally.

---

## Why this satisfies our project plan

* We can **benchmark DTA vs MCP** locally with **identical prompts and tasks**, by swapping the executor (direct call vs MCP JSON-RPC).
* Later, if we test **Claude/ChatGPT**, we keep the same tools:

  * **DTA** → register direct tools in their tool-calling API.
  * **MCP** → point their **built-in MCP client** at our MCP server.
    The protocol and flow remain the same; only the host/runtime changes. ([Claude Docs][8])

---

### One-liner takeaways for the team

* **MCP ≠ a model feature**; it’s a **runtime protocol** (JSON-RPC) between an **MCP client** and **MCP servers/tools**. ([Model Context Protocol][1])
* **ChatGPT/Claude “support MCP”** because their **runtimes** include an **MCP client** and let you add connectors. ([OpenAI Help Center][2])
* **Ollama doesn’t ship an MCP client**, but we can **wrap it** so our local setup behaves like ChatGPT/Claude with MCP. ([Model Context Protocol][6])
* **DTA vs MCP** in our repo = same tasks, same prompts; only the **executor path** changes → apples-to-apples latency/DX measurements.

[1]: https://modelcontextprotocol.io/specification/2025-03-26/basic?utm_source=chatgpt.com "Overview"
[2]: https://help.openai.com/en/articles/11487775-connectors-in-chatgpt?utm_source=chatgpt.com "Connectors in ChatGPT"
[3]: https://modelcontextprotocol.io/specification/2025-03-26/server/tools?utm_source=chatgpt.com "Tools"
[4]: https://ollama.com/blog/tool-support?utm_source=chatgpt.com "Tool support · Ollama Blog"
[5]: https://docs.mistral.ai/capabilities/function_calling/?utm_source=chatgpt.com "Function calling"
[6]: https://modelcontextprotocol.io/docs/concepts/transports?utm_source=chatgpt.com "Transports"
[7]: https://docs.anthropic.com/en/docs/build-with-claude/tool-use?utm_source=chatgpt.com "Tool use with Claude"
[8]: https://docs.claude.com/en/docs/mcp?utm_source=chatgpt.com "Model Context Protocol (MCP) - Claude Docs"
[9]: https://qwen.readthedocs.io/en/v2.0/framework/function_call.html?utm_source=chatgpt.com "Function Calling - Qwen docs"
