export function percentile(values: number[], p: number): number {
  if (!Number.isFinite(p) || p < 0 || p > 100) {
    throw new RangeError(
      `Percentile must be between 0 and 100. Received: ${p}`,
    );
  }
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Cannot compute percentile of empty dataset");
  }

  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  const lowerValue = sorted[lowerIndex];
  const upperValue = sorted[upperIndex];
  const weight = rank - lowerIndex;

  return lowerValue + weight * (upperValue - lowerValue);
}

export function summarizeTimings(values: number[]) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Cannot summarize empty timing dataset");
  }

  const sum = values.reduce((acc, value) => acc + value, 0);
  const mean = sum / values.length;

  return {
    count: values.length,
    meanMs: mean,
    p50Ms: percentile(values, 50),
    p95Ms: percentile(values, 95),
    p99Ms: percentile(values, 99),
  };
}

export type TimingSummary = ReturnType<typeof summarizeTimings>;
