import { describe, it, expect } from "vitest";
import { readFileDirect, writeFileDirect, rmFileDirect } from "../src/fs_direct";
import { randomBytes } from "node:crypto";

describe("fs_direct", () => {
  it("writes & reads", async () => {
    const p = "./tmp.test.bin";
    const data = randomBytes(1024);
    await writeFileDirect(p, data);
    const back = await readFileDirect(p);
    expect(Buffer.compare(Buffer.from(back), data)).toBe(0);
    await rmFileDirect(p);
  });
});
