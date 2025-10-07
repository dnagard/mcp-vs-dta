import { httpGetBlob } from "@proj/dta-impl";
import { runBenchCase } from "../lib/run_bench.js";
import type { TimingSummary } from "../lib/percentiles.js";
import type { BenchMcpClient } from "../mcp_client.js";

type Impl = "dta" | "mcp";

type Operation = "http";

type BenchRecord = {
  impl: Impl;
  size: number;
  operation: Operation;
  summary: TimingSummary;
  timingsMs?: number[];
  hz: number;
  url: string;
};

type SummaryRow = {
  implementation: Impl;
  sizeKB: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  hz: number;
  iterations: number;
  url: string;
};

type HttpSweepOptions = {
  sizes?: number[];
  client?: BenchMcpClient;
  collectRaw?: boolean;
  timeMs?: number;
};

const DEFAULT_SIZES = [1024, 32_768, 262_144];

const toKb = (bytes: number) => Math.round(bytes / 1024);

async function callTool(client: BenchMcpClient, name: string, args: unknown) {
  return client.callTool(name, args);
}

export async function httpSweep(impl: Impl, options: HttpSweepOptions = {}) {
  const sizes = options.sizes ?? DEFAULT_SIZES;
  const client = options.client;
  if (impl === "mcp" && !client)
    throw new Error("MCP client required for mcp implementation");

  const collectRaw = options.collectRaw ?? false;
  const timeMs = options.timeMs ??  5000;

  const base = "http://localhost:8080/blob?size=";
  const records: BenchRecord[] = [];
  const summaryRows: SummaryRow[] = [];

  for (const size of sizes) {
    const name = `${impl}-http-${toKb(size)}KB`;
    const url = base + size;

    const result = await runBenchCase({
      name,
      timeMs,
      fn: async () => {
        if (impl === "dta") {
          await httpGetBlob(url);
        } else {
          await callTool(client!, "http_get_blob", { url });
        }
      },
    });

    records.push({
      impl,
      size,
      operation: "http",
      summary: result.summary,
      timingsMs: collectRaw ? [...result.timingsMs] : undefined,
      hz: result.hz,
      url,
    });

    summaryRows.push({
      implementation: impl,
      sizeKB: toKb(size),
      meanMs: result.summary.meanMs,
      p50Ms: result.summary.p50Ms,
      p95Ms: result.summary.p95Ms,
      p99Ms: result.summary.p99Ms,
      hz: result.hz,
      iterations: result.summary.count,
      url,
    });
  }

  return {
    records,
    summary: summaryRows,
  };
}

export type HttpSweepResult = Awaited<ReturnType<typeof httpSweep>>;
