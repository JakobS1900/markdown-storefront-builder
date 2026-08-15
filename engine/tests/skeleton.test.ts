import { describe, expect, it } from "vitest";

import { ENGINE_VERSION } from "../src/index.js";

describe("engine skeleton", () => {
  it("exports a version", () => {
    expect(ENGINE_VERSION).toBe("0.0.0");
  });

  it("has no runtime dependencies, as the constitution requires", async () => {
    const manifest = await import("../package.json", {
      with: { type: "json" },
    });
    expect(manifest.default.dependencies).toBeUndefined();
  });
});
