import { describe, expect, it } from "vitest";
import { percentile, summarizeTimings } from "../lib/percentiles.js";

describe("percentile", () => {
  it("computes exact values for simple datasets", () => {
    const data = [1, 2, 3, 4, 5];
    expect(percentile(data, 0)).toBe(1);
    expect(percentile(data, 50)).toBe(3);
    expect(percentile(data, 100)).toBe(5);
  });

  it("interpolates between ranks", () => {
    const data = [10, 20, 30, 40];
    expect(percentile(data, 75)).toBe(35);
  });

  it("throws on empty dataset", () => {
    expect(() => percentile([], 50)).toThrowError(/empty/);
  });

  it("validates percentile range", () => {
    const data = [1, 2];
    expect(() => percentile(data, -1)).toThrowError(RangeError);
    expect(() => percentile(data, 101)).toThrowError(RangeError);
  });
});

describe("summarizeTimings", () => {
  it("returns mean and percentiles in milliseconds", () => {
    const data = [5, 10, 15];
    const summary = summarizeTimings(data);
    expect(summary.count).toBe(3);
    expect(summary.meanMs).toBeCloseTo(10, 5);
    expect(summary.p50Ms).toBeCloseTo(10, 5);
    expect(summary.p95Ms).toBeCloseTo(15, 5);
    expect(summary.p99Ms).toBeCloseTo(15, 5);
  });

  it("throws on empty input", () => {
    expect(() => summarizeTimings([])).toThrowError(/empty/);
  });
});
