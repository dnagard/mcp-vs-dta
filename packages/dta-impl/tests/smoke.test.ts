import { describe, it, expect } from "vitest";
import { dtaHello } from "../src/index";

describe("dta-impl", () => {
  it("smokes", () => {
    expect(dtaHello()).toBe("dta-impl ok");
  });
});
