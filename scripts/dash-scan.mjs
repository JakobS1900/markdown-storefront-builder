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

const EM_DASH = "—";
const EN_DASH = "–";

// Vendored by tooling, not authored here.
const VENDORED = [/^\.claude\/skills\//, /^\.specify\//, /^package-lock\.json$/];

const TEXT_EXT = /\.(md|ts|tsx|js|mjs|cjs|json|html|css|yml|yaml)$/;

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
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
