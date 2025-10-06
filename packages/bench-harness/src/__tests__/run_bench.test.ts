import { describe, expect, it } from "vitest";
import { runBenchCase } from "../lib/run_bench.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("runBenchCase", () => {
  it("records timings for async tasks", async () => {
    const result = await runBenchCase({
      name: "sleep",
      fn: () => sleep(1),
      timeMs: 50,
      warmup: false,
    });
    expect(result.name).toBe("sleep");
    expect(result.timingsMs.length).toBeGreaterThan(0);
    expect(result.summary.count).toBe(result.timingsMs.length);
    expect(result.summary.meanMs).toBeGreaterThan(0);
  });
});
