import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { runHarness } from "../harness.js";
import { withProfile } from "../profiles.js";
import type { HarnessRun } from "../harness.js";
import { join } from "node:path";

interface CliOptions {
  profiles: string[];
  collectRaw: boolean;
  outputPath?: string;        // JSON
  outputCsvDir?: string;      // dir for CSV (one subfolder per profile)
  outputRawCsvDir?: string;   // raw samples, optional
  timeMs?: number;
  httpSizes?: number[];
  fsSizes?: number[];
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    profiles: ["default"],
    collectRaw: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--profiles": {
        const value = argv[++i];
        if (!value) throw new Error("--profiles requires a value");
        options.profiles = value
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        if (options.profiles.length === 0) {
          throw new Error("--profiles must include at least one profile");
        }
        break;
      }
      case "--collect-raw":
        options.collectRaw = true;
        break;
      case "--output-json": {
        const value = argv[++i];
        if (!value) throw new Error("--output-json requires a path");
        options.outputPath = value;
        break;
      }
      case "--time-ms": {
        const value = argv[++i];
        if (!value) throw new Error("--time-ms requires a number");
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          throw new Error("--time-ms must be a positive number");
        }
        options.timeMs = parsed;
        break;
      }
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      case "--output-csv-dir": {
        const value = argv[++i]; if (!value) throw new Error("--output-csv-dir requires a path");
        options.outputCsvDir = value; break;
      }
      case "--output-raw-csv-dir": {
        const value = argv[++i]; if (!value) throw new Error("--output-raw-csv-dir requires a path");
        options.outputRawCsvDir = value; break;
      }
      case "--http-sizes": {
        const value = argv[++i]; if (!value) throw new Error("--http-sizes requires a list");
        options.httpSizes = value.split(",").map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);
        if (!options.httpSizes.length) throw new Error("--http-sizes must include positive numbers");
        break;
      }
      case "--fs-sizes": {
        const value = argv[++i]; if (!value) throw new Error("--fs-sizes requires a list");
        options.fsSizes = value.split(",").map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);
        if (!options.fsSizes.length) throw new Error("--fs-sizes must include positive numbers");
        break;
      }
      default:
        throw new Error(`Unknown argument: ${arg}`);
      
    }
  }

  return options;
}

function printHelp() {
  console.log(
    `Usage: bench-stats [options]\n\n` +
      `Options:\n` +
      `  --profiles <list>     Comma-separated list of profiles (default)\n` +
      `  --collect-raw         Include raw timing samples in JSON output\n` +
      `  --output-json <path>  Write JSON results to the given file/path\n` +
      `  --time-ms <number>    Override Tinybench duration per task (ms)\n` +
      `  --output-csv-dir <dir>      Write CSV to analysis/results/{profile}/bench.csv\n` +
      `  --output-raw-csv-dir <dir>  Write raw-sample CSVs (requires --collect-raw)\n` +
      `  --http-sizes <bytes,...>    Override HTTP blob sizes (e.g., 0,1024,32768,262144,1048576)\n` +
      `  --fs-sizes <bytes,...>      Override FS sizes (e.g., 4096,65536,1048576)\n` +
      `  -h, --help            Show this help message`,
    
  );
}

async function writeResult(
  run: HarnessRun,
  basePath: string,
  multiProfile: boolean,
) {
  const timestamp = new Date().toISOString();
  const payload = JSON.stringify({ timestamp, ...run }, null, 2);

  let target = resolve(process.cwd(), basePath);
  if (multiProfile) {
    const ext = extname(target);
    if (ext) {
      target = `${target.slice(0, -ext.length)}.${run.profile}${ext}`;
    } else {
      target = resolve(target, `${run.profile}.json`);
    }
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, payload, "utf8");
  console.log(`[bench-harness] Wrote ${target}`);
}

async function executeProfile(profile: string, options: CliOptions) {
  return withProfile(profile, () =>
    runHarness({
      profile,
      collectRaw: options.collectRaw,
      timeMs: options.timeMs,
      httpSizes: options.httpSizes,
      fsSizes: options.fsSizes,
    }),
  );
}

async function main() {
  let opts: CliOptions;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    printHelp();
    process.exit(1);
    return;
  }

  const multi = opts.profiles.length > 1;
  const runs: HarnessRun[] = [];

  for (const profile of opts.profiles) {
    console.log(`[bench-harness] Running profile '${profile}'...`);
    const run = await executeProfile(profile, opts);
    runs.push(run);

    console.log(`=== HTTP (DTA) [${profile}] ===`);
    console.table(run.http.dta.summary);

    console.log(`=== HTTP (MCP) [${profile}] ===`);
    console.table(run.http.mcp.summary);

    console.log(`=== FS (DTA) [${profile}] ===`);
    console.table(run.fs.dta.summary);

    console.log(`=== FS (MCP) [${profile}] ===`);
    console.table(run.fs.mcp.summary);

    if (opts.outputPath) {
      await writeResult(run, opts.outputPath, multi);          // JSON
    }
    if (opts.outputCsvDir) {
      await writeSummaryCsv(run, opts.outputCsvDir);           // summary CSV
    }
    if (opts.outputRawCsvDir && opts.collectRaw) {
      await writeRawCsvs(run, opts.outputRawCsvDir);           // raw samples CSVs
    }
  }

  if (!opts.outputPath) {
    console.log(
      "[bench-harness] No output path specified; skipping JSON export.",
    );
  }

  return runs;
}

function toSummaryCsv(run: HarnessRun): string {
  // flattened rows across HTTP/FS × DTA/MCP
  const rows: any[] = [];
  const ts = new Date().toISOString();

  const push = (section: "HTTP" | "FS", impl: "dta" | "mcp", r: any) => {
    rows.push({
      timestamp: ts,
      profile: run.profile,
      section,
      implementation: impl,
      operation: section === "FS" ? (r.operation ?? "") : "",
      sizeKB: r.sizeKB,
      meanMs: r.meanMs, p50Ms: r.p50Ms, p95Ms: r.p95Ms, p99Ms: r.p99Ms,
      hz: r.hz, iterations: r.iterations,
      url: r.url ?? "",
    });
  };

  for (const r of run.http.dta.summary) push("HTTP", "dta", r);
  for (const r of run.http.mcp.summary) push("HTTP", "mcp", r);
  for (const r of run.fs.dta.summary)  push("FS", "dta", r);
  for (const r of run.fs.mcp.summary)  push("FS", "mcp", r);

  const header = Object.keys(rows[0]).join(",");
  const body = rows.map(o => Object.values(o).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

function toRawCsv(run: HarnessRun): { filename: string; csv: string }[] {
  // one CSV per (section, impl, size[, op])
  const out: {filename: string; csv: string}[] = [];
  const ts = new Date().toISOString();

  const emit = (section: string, impl: string, size: number, label: string, timings?: number[], extra: Record<string,string|number> = {}) => {
    if (!timings || timings.length === 0) return;
    const rows = timings.map((ms, i) => ({
      timestamp: ts,
      profile: run.profile,
      section, implementation: impl, label,
      sizeBytes: size,
      sampleIndex: i,
      latencyMs: ms,
      ...extra,
    }));
    const header = Object.keys(rows[0]).join(",");
    const body = rows.map(o => Object.values(o).join(",")).join("\n");
    const safe = label.replace(/[^\w.-]+/g, "_");
    out.push({ filename: `${section}_${impl}_${size}B_${safe}.csv`, csv: `${header}\n${body}\n` });
  };

  // HTTP
  for (const impl of ["dta","mcp"] as const) {
    for (const rec of run.http[impl].records) {
      emit("HTTP", impl, rec.size, "http", rec.timingsMs, { url: rec.url });
    }
  }
  // FS
  for (const impl of ["dta","mcp"] as const) {
    for (const rec of run.fs[impl].records) {
      emit("FS", impl, rec.size, rec.operation, rec.timingsMs);
    }
  }
  return out;
}

async function writeSummaryCsv(run: HarnessRun, baseDir: string) {
  const dir = resolve(process.cwd(), baseDir, run.profile);
  await mkdir(dir, { recursive: true });
  const csv = toSummaryCsv(run);
  const target = join(dir, "bench.csv");
  await writeFile(target, csv, "utf8");
  console.log(`[bench-harness] Wrote ${target}`);
}

async function writeRawCsvs(run: HarnessRun, baseDir: string) {
  const dir = resolve(process.cwd(), baseDir, run.profile, "raw");
  await mkdir(dir, { recursive: true });
  for (const { filename, csv } of toRawCsv(run)) {
    const target = join(dir, filename);
    await writeFile(target, csv, "utf8");
    console.log(`[bench-harness] Wrote ${target}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
