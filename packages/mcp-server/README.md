# @proj/mcp-server

Stdio-based JSON-RPC 2.0 bridge that exposes the repository tools in an MCP-compatible format. The server accepts newline-delimited JSON requests on stdin and emits one JSON-RPC response per request on stdout. Human-readable logs are written to stderr.

## Quick start

```bash
pnpm -C packages/mcp-server run build   # compile TypeScript to dist/
pnpm -C packages/mcp-server run dev     # start the server with tsx
```

On startup the server ensures a sandbox directory and prints `ready` to stderr. Use any JSON-RPC client that supports NDJSON framing, e.g. `printf`/`cat` or the included agent runner/bench harness.

## Methods

- `tools/list` – returns `{ tools: [{ name, description?, input_schema }, ...] }`.
- `tools/call` – expects `{ name: string, arguments: object }` and returns the underlying tool result.

Errors follow the JSON-RPC conventions:

| Code     | Meaning                             |
| -------- | ----------------------------------- |
| `-32700` | Parse error (malformed JSON)        |
| `-32600` | Invalid request envelope            |
| `-32601` | Unknown method/tool                 |
| `-32602` | Invalid params (validation/sandbox) |
| `-32000` | Execution error (IO/network)        |

## Environment variables

- `MCP_SANDBOX_ROOT`: absolute/relative path used to resolve file operations (defaults to `<cwd>/sandbox`).
- `MCP_CMD` / `MCP_ARGS`: honoured by consumers such as the agent runner and benchmarks if you want to swap the server binary or pass custom flags.

## Example interaction

```text
# request
{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":"write_file","arguments":{"path":"note.txt","data":"hello"}}}

# response
{"jsonrpc":"2.0","id":"1","result":{"ok":true,"path":"/abs/path/note.txt","bytes":5}}
```

See `packages/bench-harness` for a programmatic client and `packages/agent-runner` for LLM-driven usage.
