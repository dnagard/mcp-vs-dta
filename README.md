# MCP vs DTA

A playground for comparing Model Context Protocol (MCP) style tool adapters to direct tool adapters (DTA). The repository contains two minimal implementations—one that talks straight to Node.js primitives and another that mimics an MCP bridge—and a tiny benchmarking harness for exercising filesystem and HTTP scenarios.

## Repository layout

- `packages/dta-impl/` – direct file and HTTP helpers implemented with Node.js standard library APIs.
- `packages/mcp-impl/` – stubbed MCP-facing wrappers that forward into the DTA helpers.
- `packages/bench-harness/` – tinybench-based scenarios that compare the MCP and DTA code paths.
- `scripts/` – utilities for seeding mock HTTP endpoints and applying Linux `netem` settings.
- `.devcontainer/` – VS Code Dev Container configuration preloaded with Node 20, pnpm, GitHub CLI, and networking capabilities for netem experiments.

## Requirements

- Node.js 20.x (the devcontainer image installs it automatically).
- pnpm 9 (`corepack enable` ensures the right version locally).
- Optional: `tc` (traffic control) with `netem` support if you want to run latency/packet-loss experiments outside the devcontainer.
- Optional: [Ollama](https://ollama.com/download) (on the host machine, Windows or macOS) if you want to run the `agent-runner` package.
  - After installation, pull a model such as `llama3.1:8b`:
    ```bash
    ollama pull llama3.1:8b
    ```
  - Test it on the host:
    ```bash
    ollama serve
    ollama run llama3.1:8b
    ```
  - The devcontainer connects to it via `http://host.docker.internal:11434`. (this is configured in `packages/agent-runner/src/clients/ollama.ts`)

## Quick start

```bash
# Clone the repo, then run:
corepack enable
pnpm install
```

Build every workspace package:

```bash
pnpm build
```

Each package ships with TypeScript build output in `dist/`.

## Common commands

- `pnpm init` – alias for `pnpm install` (mirrors the Makefile `init` target).
- `pnpm build` – run `tsc` for every workspace package.
- `pnpm test` – execute all Vitest suites across packages.
- `pnpm lint` – run ESLint across the monorepo.
- `pnpm format` – apply Prettier to the entire codebase.
- `pnpm mock` – start the mock HTTP server on `http://localhost:8080` (used by the benchmarks).
- `pnpm bench` – build the implementations and execute the benchmark harness.
- `pnpm bench:netem` – apply a 40 ms ±10 ms/1 % loss network profile (requires `sudo`), run the benchmark, then clear `netem`.

### Package-level scripts

You can iterate on individual packages via pnpm’s `-C` flag:

- `pnpm -C packages/dta-impl run dev`
- `pnpm -C packages/mcp-impl run dev`
- `pnpm -C packages/bench-harness run bench`

Each package also exposes `build` and `test` scripts.

## Benchmark workflow

1. Start the mock upstream in a dedicated terminal: `pnpm mock`.
2. In another terminal run `pnpm bench` to compare MCP vs DTA HTTP/blob and filesystem operations.
3. For percentile metrics (p50/p95/p99) and JSON artifacts, run `pnpm -C packages/bench-harness run bench:stats --output-json analysis/results/default.json`. Add `--collect-raw` to embed per-iteration timing samples.
4. (Optional) Use `pnpm bench:netem` or `pnpm -C packages/bench-harness run bench:stats --profiles netem40 --output-json analysis/results/netem.json` to re-run the suite under simulated network latency/loss. These scripts rely on `tc netem` and need elevated privileges—prefer running them inside the devcontainer where NET_ADMIN is granted.

Benchmark runs now emit console tables and machine-readable JSON payloads capturing mean, p50, p95, and p99 latencies for each scenario.

## MCP server

The `@proj/mcp-server` package implements a JSON-RPC 2.0 bridge that exposes the repository tools over an MCP-compatible stdio channel.

- Build once (creates `dist/` so other packages can invoke the binary):
  ```bash
  pnpm -C packages/mcp-server run build
  ```
- Run the server in dev mode:
  ```bash
  pnpm -C packages/mcp-server run dev
  ```
  The process prints `ready` to stderr and waits for newline-delimited JSON requests on stdin. Exactly one JSON-RPC response is emitted per request.
- Environment variables:
  - `MCP_SANDBOX_ROOT` – absolute/relative path used as the filesystem sandbox (defaults to `<cwd>/sandbox`).
  - `MCP_CMD` / `MCP_ARGS` – used by consumers (agent runner, benchmarks) to override the launched binary/arguments.

Example request/response pairs:

```json
{"jsonrpc":"2.0","id":"1","method":"tools/list"}
{"jsonrpc":"2.0","id":"1","result":{"tools":[...]}}

{"jsonrpc":"2.0","id":"2","method":"tools/call","params":{"name":"write_file","arguments":{"path":"notes.txt","data":"hello"}}}
{"jsonrpc":"2.0","id":"2","result":{"ok":true,"path":"/abs/sandbox/notes.txt","bytes":5}}
```

## Agent runner (LLM integration with Ollama)

The `packages/agent-runner` package lets a local LLM (running via [Ollama](https://ollama.com)) call the same tools defined in this repo.  
This demonstrates how DTA vs MCP implementations can be driven by a model.

### Setup

1. Install Ollama on your **host machine** (Windows/macOS): https://ollama.com/download
2. Pull a small model such as `llama3.1:8b` (outside the devcontainer):
   ```bash
   ollama pull llama3.1:8b
   ollama serve
   ollama run llama3.1:8b
   ```
3. Run the agent (from inside the devcontainer):

```
pnpm --filter @proj/agent-runner agent:dta
```

4. The agent writes/reads files under `packages/agent-runner/sandbox/`
5. For HTTP tools, start the mock server first with `pnpm mock` (this is not implemented yet)

## Development container

Open the repository in VS Code and choose **Dev Containers: Reopen in Container**. The container:

- builds from `.devcontainer/Dockerfile` (Ubuntu + Node.js 20 + pnpm + autocannon),
- runs `pnpm install` automatically on first start,
- mounts a persistent GitHub CLI config volume, and
- grants `NET_ADMIN` so `pnpm bench:netem` works without extra configuration.

## Makefile shortcuts

The `Makefile` mirrors the pnpm scripts (`init`, `build`, `test`, `bench`) and adds helpers for `netem-40ms` and `netem-clear`. These are optional conveniences if you prefer `make` over npm scripts.

## Useful tips

- Vitest is run in "dot" reporter mode for succinct output; add `--watch` manually when iterating locally.
- The TypeScript project uses `tsconfig.base.json` with path aliases that target the built `dist/` folders—run `pnpm build` before importing packages from each other.
- When adding new benchmark scenarios, drop the files inside `packages/bench-harness/src/scenarios/` and register them in `src/harness.ts`.
