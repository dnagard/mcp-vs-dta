import { describe, expect, it, vi, beforeEach } from "vitest";

const spawnMock = vi.fn();

vi.mock("node:child_process", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    spawn: spawnMock.mockImplementation(() => {
      const emitter = new EventEmitter();
      process.nextTick(() => emitter.emit("close", 0));
      return emitter as any;
    }),
  };
});

import { withProfile } from "../profiles.js";

beforeEach(() => {
  spawnMock.mockClear();
});

describe("withProfile", () => {
  it("does not run scripts for default profile", async () => {
    await withProfile("default", async () => {
      return "ok";
    });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("runs setup and teardown scripts for netem profile", async () => {
    await withProfile("netem40", async () => {
      expect(spawnMock).toHaveBeenCalledTimes(1);
    });
    expect(spawnMock).toHaveBeenCalledTimes(2);
  });

  it("still attempts teardown when runner throws", async () => {
    await expect(
      withProfile("netem40", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect(spawnMock).toHaveBeenCalledTimes(2);
  });
});
