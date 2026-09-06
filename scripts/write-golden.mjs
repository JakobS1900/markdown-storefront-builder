/**
 * Regenerates the golden output files.
 *
 * Run this ONLY after a deliberate change to an emitter or a target record, and
 * READ the diff before committing. A golden test failing is the guard working.
 * Regenerating to make a red test green without knowing why it went red defeats
 * the entire mechanism.
 *
 * Reads the built engine from engine/dist, so run `npm run build` first.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const { validateDocument } = await import("../engine/dist/document/validate.js");
const { compile } = await import("../engine/dist/compile/compile.js");
// ALL_TARGETS, so the menu file gets golden files too. The harness keys its
// directories by target id and is driven by whichever array is imported here,
// so a target missing from it simply has no golden files and the golden test
// then fails looking for them, which is the loud direction.
const { ALL_TARGETS } = await import("../engine/dist/compile/targets.js");

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

const fixtureDir = here("../engine/tests/compile/fixtures");
const names = readdirSync(fixtureDir).filter((f) => f.endsWith(".json")).sort();

let written = 0;

for (const target of ALL_TARGETS) {
  const outDir = here(`../engine/tests/compile/golden/${target.id}`);
  mkdirSync(outDir, { recursive: true });

  for (const name of names) {
    const parsed = JSON.parse(readFileSync(`${fixtureDir}/${name}`, "utf8"));
    const result = validateDocument(parsed);
    if (!result.ok) {
      console.error(`fixture ${name} is not a valid page:`, result.issues);
      process.exit(1);
    }

    const base = name.replace(/\.json$/, "");
    // The record, not the id. `findTarget` searches the paste hosts only, so an
    // id would write the portable output into every menu-file golden and the
    // golden test would then happily agree with it.
    writeFileSync(`${outDir}/${base}.md`, compile(result.document, target).markdown, "utf8");
    written += 1;
  }
}

console.log(`Wrote ${written} golden file(s) across ${ALL_TARGETS.length} target(s).`);
console.log("Read the diff before committing. These files are the compiler's guard.");
