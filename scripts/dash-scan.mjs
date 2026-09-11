/**
 * Dash scan. Project non-negotiable: no em dashes and no en dashes anywhere in
 * code, comments, commit messages, docs, specs, or UI copy.
 *
 * Enforced here rather than trusted to care, because a rule that depends on
 * everyone remembering it is not a rule.
 *
 * Vendored files are excluded. We did not write the Spec-Kit templates and
 * skills, and rewriting them would be undone by the next tool upgrade.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Built from code points deliberately, so this file does not trip its own scan.
// U+2014 EM DASH, U+2013 EN DASH.
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

// Vendored by tooling, not authored here.
const VENDORED = [/^\.claude\/skills\//, /^\.specify\//, /^package-lock\.json$/];

const TEXT_EXT = /\.(md|ts|tsx|js|mjs|cjs|json|html|css|yml|yaml)$/;

// `--others --exclude-standard` alongside the default `--cached`, so a file
// that has been written but not staged is scanned too. Without them this gate
// could not see a new file at all, and a new file is exactly where a first
// mistake lives: it went green over a file with an em dash in it on 2026-09-09,
// reporting "clean, 321 files checked", and only started failing once the file
// was staged. Anything ignored by `.gitignore` stays ignored, which is what
// `--exclude-standard` is for, so `node_modules` and `dist` do not come back.
const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean)
  .filter((f) => TEXT_EXT.test(f))
  .filter((f) => !VENDORED.some((re) => re.test(f)));

const findings = [];

for (const file of files) {
  let contents;
  try {
    contents = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (!contents.includes(EM_DASH) && !contents.includes(EN_DASH)) continue;

  contents.split(/\r?\n/).forEach((line, i) => {
    for (const [ch, name] of [
      [EM_DASH, "em dash"],
      [EN_DASH, "en dash"],
    ]) {
      const col = line.indexOf(ch);
      if (col !== -1) {
        findings.push({ file, line: i + 1, col: col + 1, name, text: line.trim() });
      }
    }
  });
}

if (findings.length > 0) {
  console.error(`Dash scan FAILED: ${findings.length} finding(s).\n`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}:${f.col}  ${f.name}`);
    console.error(`    ${f.text.slice(0, 100)}`);
  }
  console.error("\nProject non-negotiable: no em dashes or en dashes. Use a comma, a colon, or a full stop.");
  process.exit(1);
}

console.log(`Dash scan clean. ${files.length} authored file(s) checked.`);
