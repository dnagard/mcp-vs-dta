import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { runHarness } from "../harness.js";
import { withProfile } from "../profiles.js";
import type { HarnessRun } from "../harness.js";

interface CliOptions {
  profiles: string[];
  collectRaw: boolean;
  outputPath?: string;
  timeMs?: number;
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
        options.profiles = value.split(",").map((p) => p.trim()).filter(Boolean);
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
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: bench-stats [options]\n\n` +
    `Options:\n` +
    `  --profiles <list>     Comma-separated list of profiles (default)\n` +
    `  --collect-raw         Include raw timing samples in JSON output\n` +
    `  --output-json <path>  Write JSON results to the given file/path\n` +
    `  --time-ms <number>    Override Tinybench duration per task (ms)\n` +
    `  -h, --help            Show this help message`);
}

async function writeResult(run: HarnessRun, basePath: string, multiProfile: boolean) {
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
    })
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
      await writeResult(run, opts.outputPath, multi);
    }
  }

  if (!opts.outputPath) {
    console.log("[bench-harness] No output path specified; skipping JSON export.");
  }

  return runs;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
