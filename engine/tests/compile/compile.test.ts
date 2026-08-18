import { describe, expect, it } from "vitest";

import { compile } from "../../src/compile/compile.js";
import type { Target } from "../../src/compile/capabilities.js";
import { PORTABLE, RENTRY, TARGETS, findTarget } from "../../src/compile/targets.js";
import type { Document } from "../../src/document/types.js";

/**
 * The compiler entry point. FR-001 to FR-012, FR-015.
 */

function page(...blocks: Document["blocks"]): Document {
  return { schemaVersion: 1, target: "portable", blocks };
}

describe("FR-001: a page becomes Markdown", () => {
  it("emits a heading", () => {
    const out = compile(page({ id: "h", kind: "heading", text: "Commissions", level: 1 }), "portable");
    expect(out.markdown).toBe("# Commissions\n");
  });

  it("emits a separator", () => {
    expect(compile(page({ id: "d", kind: "divider" }), "portable").markdown).toBe("***\n");
  });

  it("joins blocks with exactly one blank line", () => {
    const out = compile(
      page(
        { id: "a", kind: "heading", text: "One", level: 1 },
        { id: "b", kind: "heading", text: "Two", level: 2 },
      ),
      "portable",
    );
    expect(out.markdown).toBe("# One\n\n## Two\n");
  });

  it("compiles an empty page to an empty string, not a stray newline", () => {
    const out = compile(page(), "portable");
    expect(out.markdown).toBe("");
    expect(out.diagnostics).toEqual([]);
  });
});

describe("FR-002: compile never throws", () => {
  it.each(["portable", "rentry", "", "nonsense", "PORTABLE", "../../etc"])(
    "survives target id %j",
    (id) => {
      expect(() => compile(page({ id: "h", kind: "heading", text: "x", level: 1 }), id)).not.toThrow();
    },
  );

  it("emits every block kind, since feature 003 completed the set", () => {
    // This test previously asserted that prose was SKIPPED, which was true
    // while its emitter did not exist. It now asserts the opposite, which is
    // the point of feature 003.
    const out = compile(
      page(
        { id: "h", kind: "heading", text: "Kept", level: 2 },
        { id: "p", kind: "prose", text: "Also kept" },
        { id: "d", kind: "divider" },
      ),
      "portable",
    );
    expect(out.markdown).toBe("## Kept\n\nAlso kept\n\n***\n");
    expect(out.diagnostics).toEqual([]);
  });
});

describe("FR-003: identical input gives identical output", () => {
  it("produces the same text on repeated calls", () => {
    const doc = page({ id: "h", kind: "heading", text: "Stable", level: 3 });
    const first = compile(doc, "rentry").markdown;
    for (let i = 0; i < 20; i += 1) {
      expect(compile(doc, "rentry").markdown).toBe(first);
    }
  });

  it("produces the same text for two independently built equal pages", () => {
    const a = compile(page({ id: "h", kind: "heading", text: "Same", level: 2 }), "portable");
    const b = compile(page({ id: "h", kind: "heading", text: "Same", level: 2 }), "portable");
    expect(a.markdown).toBe(b.markdown);
  });
});

describe("FR-008: an unknown host falls back and warns", () => {
  it("compiles against the portable baseline", () => {
    const out = compile(page({ id: "h", kind: "heading", text: "Held", level: 2 }), "some-future-host");
    expect(out.markdown).toBe("## Held\n");
    expect(out.targetId).toBe(PORTABLE.id);
  });

  it("warns, naming the host it did not recognise", () => {
    const out = compile(page(), "some-future-host");
    expect(out.diagnostics).toHaveLength(1);
    expect(out.diagnostics[0]?.code).toBe("unknown_target");
    expect(out.diagnostics[0]?.severity).toBe("warning");
    expect(out.diagnostics[0]?.message).toContain("some-future-host");
  });

  it("does not warn when the host is known", () => {
    expect(compile(page(), "rentry").diagnostics).toEqual([]);
    expect(compile(page(), "portable").diagnostics).toEqual([]);
  });

  it("reports the target actually used, not the one requested", () => {
    expect(compile(page(), "unknown").targetId).toBe("portable");
    expect(compile(page(), "rentry").targetId).toBe("rentry");
  });
});

describe("FR-012: a heading too deep for the host degrades, with a warning", () => {
  const shallow: Target = {
    id: "shallow-test-host",
    name: "Shallow Test Host",
    capabilities: { maxHeadingLevel: 2, thematicBreak: "***", tables: true, hardBreak: "backslash", escapeStyle: "commonmark" },
    sources: {
      maxHeadingLevel: "test fixture",
      thematicBreak: "test fixture",
      tables: "test fixture",
      hardBreak: "test fixture",
      escapeStyle: "test fixture",
      maxBytes: "test fixture",
    },
  };

  it("emits at the deepest level the host supports", () => {
    const out = compile(page({ id: "h", kind: "heading", text: "Deep", level: 5 }), shallow);
    expect(out.markdown).toBe("## Deep\n");
  });

  it("names the section and says what will happen instead (SC-005)", () => {
    const out = compile(page({ id: "deep-one", kind: "heading", text: "Deep", level: 5 }), shallow);
    const warning = out.diagnostics.find((d) => d.code === "heading_level_reduced");
    expect(warning?.blockId).toBe("deep-one");
    expect(warning?.capability).toBe("maxHeadingLevel");
    expect(warning?.message).toContain("Shallow Test Host");
    expect(warning?.severity).toBe("warning");
  });

  it("does not warn for a heading the host can render", () => {
    const out = compile(page({ id: "h", kind: "heading", text: "Fine", level: 2 }), shallow);
    expect(out.diagnostics).toEqual([]);
  });

  it("never emits more hashes than the host supports", () => {
    for (let level = 1; level <= 6; level += 1) {
      const out = compile(page({ id: "h", kind: "heading", text: "x", level }), shallow);
      expect(out.markdown.split(" ")[0]?.length).toBeLessThanOrEqual(2);
    }
  });

  it("both shipped hosts support all six levels, so neither warns", () => {
    for (const target of TARGETS) {
      for (let level = 1; level <= 6; level += 1) {
        const out = compile(page({ id: "h", kind: "heading", text: "x", level }), target.id);
        expect(out.diagnostics).toEqual([]);
      }
    }
  });
});

describe("FR-015: output over a host's limit warns and is returned in full", () => {
  const tiny: Target = {
    id: "tiny-test-host",
    name: "Tiny Test Host",
    capabilities: {
      maxHeadingLevel: 6,
      thematicBreak: "***",
      tables: true,
      hardBreak: "backslash",
      escapeStyle: "commonmark",
      maxBytes: 20,
    },
    sources: {
      maxHeadingLevel: "test fixture",
      thematicBreak: "test fixture",
      tables: "test fixture",
      hardBreak: "test fixture",
      escapeStyle: "test fixture",
      maxBytes: "test fixture",
    },
  };

  it("warns when the output exceeds the limit", () => {
    const out = compile(page({ id: "h", kind: "heading", text: "x".repeat(100), level: 1 }), tiny);
    const warning = out.diagnostics.find((d) => d.code === "size_limit_exceeded");
    expect(warning?.severity).toBe("warning");
    expect(warning?.capability).toBe("maxBytes");
  });

  it("returns the whole page, never truncated", () => {
    const out = compile(page({ id: "h", kind: "heading", text: "x".repeat(100), level: 1 }), tiny);
    expect(out.markdown).toContain("x".repeat(100));
  });

  it("says nothing has been removed, because nothing has", () => {
    const out = compile(page({ id: "h", kind: "heading", text: "x".repeat(100), level: 1 }), tiny);
    expect(out.diagnostics.find((d) => d.code === "size_limit_exceeded")?.message).toContain(
      "Nothing has been removed",
    );
  });

  it("does not warn when the output fits", () => {
    const out = compile(page({ id: "h", kind: "heading", text: "ok", level: 1 }), tiny);
    expect(out.diagnostics).toEqual([]);
  });

  it("counts bytes, not characters, so emoji are measured honestly", () => {
    // A four byte emoji is one character. Counting characters would understate
    // exactly the pages most likely to hit a limit.
    const out = compile(page({ id: "h", kind: "heading", text: "\u{1F3A8}".repeat(6), level: 1 }), tiny);
    expect(out.diagnostics.some((d) => d.code === "size_limit_exceeded")).toBe(true);
  });

  it("neither shipped host declares a limit, so neither can warn", () => {
    for (const target of TARGETS) {
      expect(target.capabilities.maxBytes).toBeUndefined();
    }
  });
});

describe("the registry", () => {
  it("finds a shipped host by id", () => {
    expect(findTarget("rentry")).toBe(RENTRY);
    expect(findTarget("portable")).toBe(PORTABLE);
  });

  it("returns undefined for an unknown id rather than guessing", () => {
    expect(findTarget("nope")).toBeUndefined();
  });
});
