import { describe, it, expect } from "vitest";
import { mcpHello } from "../src/index";

describe("mcp-impl", () => {
  it("smokes", () => {
    expect(mcpHello()).toBe("mcp-impl ok");
  });
});
