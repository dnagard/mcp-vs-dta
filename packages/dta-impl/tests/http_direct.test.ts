import { describe, it, expect } from "vitest";
import { httpGetBlob } from "../src/http_direct";

describe("http_direct", () => {
  it("fetches /ping", async () => {
    // Start your mock server separately: pnpm tsx scripts/seed_endpoints.ts
    const buf = await httpGetBlob("http://localhost:8080/ping");
    const text = Buffer.from(buf).toString("utf8");
    expect(text).toMatch(/"ok":\s*true/);
  });
});
