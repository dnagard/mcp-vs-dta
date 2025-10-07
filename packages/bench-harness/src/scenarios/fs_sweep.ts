import { randomBytes } from "node:crypto";
import { writeFileDirect, readFileDirect, rmFileDirect } from "@proj/dta-impl";
import type { BenchMcpClient } from "../mcp_client.js";
import { runBenchCase } from "../lib/run_bench.js";
import type { TimingSummary } from "../lib/percentiles.js";

type Impl = "dta" | "mcp";

type Operation = "write" | "read" | "remove";

type BenchRecord = {
  impl: Impl;
  size: number;
  operation: Operation;
  summary: TimingSummary;
  timingsMs?: number[];
  hz: number;
};

type SummaryRow = {
  implementation: Impl;
  operation: Operation;
  sizeKB: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  hz: number;
  iterations: number;
};

type FsSweepOptions = {
  sizes?: number[];
  client?: BenchMcpClient;
  collectRaw?: boolean;
  timeMs?: number;
};

const DEFAULT_SIZES = [4_096, 65_536, 1_048_576];

const toKb = (bytes: number) => Math.round(bytes / 1024);

async function callTool(client: BenchMcpClient, name: string, args: unknown) {
  return client.callTool(name, args);
}

export async function fsSweep(impl: Impl, options: FsSweepOptions = {}) {
  const sizes = options.sizes ?? DEFAULT_SIZES;
  const client = options.client;
  if (impl === "mcp" && !client)
    throw new Error("MCP client required for mcp implementation");

  const timeMs = options.timeMs ?? 200;
  const collectRaw = options.collectRaw ?? false;

  const records: BenchRecord[] = [];
  const summaryRows: SummaryRow[] = [];

  for (const size of sizes) {
    const payload = randomBytes(size).toString("base64");
    const path = `./tmp-${impl}-${size}.txt`;

    const write = await runBenchCase({
      name: `${impl}-fs-write-${toKb(size)}KB`,
      timeMs,
      fn: async () => {
        if (impl === "dta") {
          await writeFileDirect(path, payload);
        } else {
          await callTool(client!, "write_file", { path, data: payload });
        }
      },
    });

    records.push({
      impl,
      size,
      operation: "write",
      summary: write.summary,
      timingsMs: collectRaw ? [...write.timingsMs] : undefined,
      hz: write.hz,
    });

    summaryRows.push({
      implementation: impl,
      operation: "write",
      sizeKB: toKb(size),
      meanMs: write.summary.meanMs,
      p50Ms: write.summary.p50Ms,
      p95Ms: write.summary.p95Ms,
      p99Ms: write.summary.p99Ms,
      hz: write.hz,
      iterations: write.summary.count,
    });

    const read = await runBenchCase({
      name: `${impl}-fs-read-${toKb(size)}KB`,
      timeMs,
      fn: async () => {
        if (impl === "dta") {
          await readFileDirect(path);
        } else {
          await callTool(client!, "read_file", { path });
        }
      },
    });

    records.push({
      impl,
      size,
      operation: "read",
      summary: read.summary,
      timingsMs: collectRaw ? [...read.timingsMs] : undefined,
      hz: read.hz,
    });

    summaryRows.push({
      implementation: impl,
      operation: "read",
      sizeKB: toKb(size),
      meanMs: read.summary.meanMs,
      p50Ms: read.summary.p50Ms,
      p95Ms: read.summary.p95Ms,
      p99Ms: read.summary.p99Ms,
      hz: read.hz,
      iterations: read.summary.count,
    });

    const remove = await runBenchCase({
      name: `${impl}-fs-rm-${toKb(size)}KB`,
      timeMs,
      fn: async () => {
        if (impl === "dta") {
          await rmFileDirect(path);
        } else {
          await callTool(client!, "remove_file", { path });
        }
      },
    });

    records.push({
      impl,
      size,
      operation: "remove",
      summary: remove.summary,
      timingsMs: collectRaw ? [...remove.timingsMs] : undefined,
      hz: remove.hz,
    });

    summaryRows.push({
      implementation: impl,
      operation: "remove",
      sizeKB: toKb(size),
      meanMs: remove.summary.meanMs,
      p50Ms: remove.summary.p50Ms,
      p95Ms: remove.summary.p95Ms,
      p99Ms: remove.summary.p99Ms,
      hz: remove.hz,
      iterations: remove.summary.count,
    });
  }

  return {
    records,
    summary: summaryRows,
  };
}

export type FsSweepResult = Awaited<ReturnType<typeof fsSweep>>;
