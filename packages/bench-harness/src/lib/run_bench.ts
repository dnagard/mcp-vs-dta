import { Bench } from "tinybench";
import { summarizeTimings, type TimingSummary } from "./percentiles.js";

export interface BenchCaseOptions {
  name: string;
  fn: () => unknown | Promise<unknown>;
  timeMs?: number;
  iterations?: number;
  warmup?: boolean;
}

export interface BenchCaseResult {
  name: string;
  timingsMs: number[];
  summary: TimingSummary;
  hz: number;
}

export async function runBenchCase(
  options: BenchCaseOptions,
): Promise<BenchCaseResult> {
  const { name, fn, timeMs = 200, iterations, warmup = true } = options;

  const bench = new Bench({ time: timeMs, iterations });
  bench.add(name, fn);

  if (warmup) {
    await bench.warmup();
  }

  await bench.run();
  const [task] = bench.tasks;
  if (!task) {
    throw new Error(`Tinybench returned no task for ${name}`);
  }
  const result = task.result;
  if (!result) {
    throw new Error(`Benchmark task ${name} produced no result`);
  }
  if (result.error) {
    throw result.error;
  }

  const timings = result.samples;
  const summary = summarizeTimings(timings);

  return {
    name: task.name,
    timingsMs: timings,
    summary,
    hz: result.hz,
  };
}
