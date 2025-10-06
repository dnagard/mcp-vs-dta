import { httpSweep, type HttpSweepResult } from "./scenarios/http_sweep.js";
import { fsSweep, type FsSweepResult } from "./scenarios/fs_sweep.js";
import { BenchMcpClient } from "./mcp_client.js";

export interface HarnessOptions {
  profile?: string;
  collectRaw?: boolean;
  timeMs?: number;
  httpSizes?: number[];
  fsSizes?: number[];
}

export interface HarnessRun {
  profile: string;
  http: {
    dta: HttpSweepResult;
    mcp: HttpSweepResult;
  };
  fs: {
    dta: FsSweepResult;
    mcp: FsSweepResult;
  };
}

export async function runHarness(options: HarnessOptions = {}): Promise<HarnessRun> {
  const profile = options.profile ?? "default";
  const collectRaw = options.collectRaw ?? false;
  const timeMs = options.timeMs;

  const httpBase = {
    collectRaw,
    timeMs,
    sizes: options.httpSizes,
  } as const;

  const fsBase = {
    collectRaw,
    timeMs,
    sizes: options.fsSizes,
  } as const;

  const mcp = new BenchMcpClient();
  try {
    await mcp.listTools();

    const httpDta = await httpSweep("dta", httpBase);
    const httpMcp = await httpSweep("mcp", { ...httpBase, client: mcp });

    const fsDta = await fsSweep("dta", fsBase);
    const fsMcp = await fsSweep("mcp", { ...fsBase, client: mcp });

    return {
      profile,
      http: { dta: httpDta, mcp: httpMcp },
      fs: { dta: fsDta, mcp: fsMcp },
    };
  } finally {
    await mcp.dispose();
  }
}

async function main() {
  const run = await runHarness();

  console.log(`=== HTTP (DTA) [${run.profile}] ===`);
  console.table(run.http.dta.summary);

  console.log(`=== HTTP (MCP) [${run.profile}] ===`);
  console.table(run.http.mcp.summary);

  console.log(`=== FS (DTA) [${run.profile}] ===`);
  console.table(run.fs.dta.summary);

  console.log(`=== FS (MCP) [${run.profile}] ===`);
  console.table(run.fs.mcp.summary);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
