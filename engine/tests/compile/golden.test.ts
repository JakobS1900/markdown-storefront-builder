import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { validateDocument } from "../../src/document/validate.js";
import { compile } from "../../src/compile/compile.js";
import { TARGETS } from "../../src/compile/targets.js";

/**
 * The golden harness. FR-013, SC-001.
 *
 * Every fixture is compiled for every target and compared against a checked-in
 * `.md` file, byte for byte. Those files are real Markdown a person can read
 * and judge, which is the whole point: when one of these fails, the diff has to
 * be legible, because that is exactly the moment you most need to read it.
 *
 * To update after a deliberate change: `npm run golden`. Then READ the diff.
 */

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

const fixtureNames = readdirSync(here("./fixtures"))
  .filter((f) => f.endsWith(".json"))
  .sort();

/**
 * Research D9: the comparison normalises CRLF to LF on both sides.
 *
 * This repository is on Windows and git rewrites line endings in the working
 * copy, as every commit has warned. Without this the golden tests would pass on
 * one machine and fail on another, turning the strongest guarantee in the
 * project into noise. The compiler itself always emits LF; only the comparison
 * normalises.
 */
function lf(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function loadFixture(name: string) {
  const parsed: unknown = JSON.parse(readFileSync(here(`./fixtures/${name}`), "utf8"));
  const result = validateDocument(parsed);
  if (!result.ok) {
    throw new Error(`fixture ${name} is not a valid page: ${JSON.stringify(result.issues)}`);
  }
  return result.document;
}

describe("golden files", () => {
  it("has at least one fixture, so an empty directory cannot pass silently", () => {
    expect(fixtureNames.length).toBeGreaterThan(0);
  });

  for (const target of TARGETS) {
    describe(target.id, () => {
      for (const name of fixtureNames) {
        const base = name.replace(/\.json$/, "");

        it(`compiles ${base} to the expected output`, () => {
          const doc = loadFixture(name);
          const actual = compile(doc, target.id).markdown;
          const expected = readFileSync(here(`./golden/${target.id}/${base}.md`), "utf8");
          expect(lf(actual)).toBe(lf(expected));
        });
      }
    });
  }
});

describe("SC-001: output renders as Markdown, not as broken text", () => {
  it.each(fixtureNames)("%s produces no raw angle bracket for any target", (name) => {
    const doc = loadFixture(name);
    for (const target of TARGETS) {
      const { markdown } = compile(doc, target.id);
      expect(markdown).not.toContain("<");
      expect(markdown).not.toContain(">");
    }
  });

  it.each(fixtureNames)("%s ends with exactly one newline, or is empty", (name) => {
    const doc = loadFixture(name);
    for (const target of TARGETS) {
      const { markdown } = compile(doc, target.id);
      if (markdown === "") continue;
      expect(markdown.endsWith("\n")).toBe(true);
      expect(markdown.endsWith("\n\n")).toBe(false);
    }
  });

  it.each(fixtureNames)("%s has no trailing whitespace on any line", (name) => {
    // Review R-3. Trailing whitespace is invisible, is stripped on save by many
    // editors, and would break byte comparison with an unreadable diff.
    const doc = loadFixture(name);
    for (const target of TARGETS) {
      const { markdown } = compile(doc, target.id);
      for (const line of markdown.split("\n")) {
        expect(line).toBe(line.replace(/[ \t]+$/, ""));
      }
    }
  });

  it.each(fixtureNames)("%s never emits a --- separator (review R-1)", (name) => {
    // A line of --- makes the preceding line a heading and is read as front
    // matter at the start of a document.
    const doc = loadFixture(name);
    for (const target of TARGETS) {
      const { markdown } = compile(doc, target.id);
      for (const line of markdown.split("\n")) {
        expect(line.trim()).not.toBe("---");
      }
    }
  });
});
