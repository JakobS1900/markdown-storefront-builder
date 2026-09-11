/**
 * Secret scan. Constitution Principle IV: no secret may ever appear in the
 * client bundle, and CI must fail on a hit.
 *
 * Scans git-tracked files only, so it cannot be fooled by an untracked local
 * file and cannot be slowed down by node_modules.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const PATTERNS = [
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: "Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "Stripe secret key", re: /\bsk_live_[A-Za-z0-9]{16,}\b/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "OpenAI-style key", re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: "Private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  {
    name: "Assigned secret literal",
    re: /\b(?:api[_-]?key|secret|password|passwd|token|client[_-]?secret)\b\s*[:=]\s*["'][^"'\s]{12,}["']/i,
  },
];

// Files whose whole job is to describe secret patterns.
const ALLOWLIST = new Set(["scripts/secret-scan.mjs"]);

const BINARY_EXT =
  /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|eot|mp4|mov|wasm)$/i;

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Everything git would carry, plus everything written and not yet staged.
 *
 * The second half is the point, and its absence was a real hole. `git ls-files`
 * on its own lists tracked and staged files, so a brand new file was invisible
 * to this gate until somebody staged it, and `npm run verify` went green over
 * it. That is the wrong way round: a new file is the most likely place for a
 * first mistake, and a credential pasted into one would have passed every gate
 * right up to the commit that added it.
 *
 * Demonstrated on 2026-09-09 with the sibling dash gate, which reported "clean,
 * 321 files checked" over an untracked file containing an em dash and failed on
 * the same file the moment it was staged.
 *
 * `--exclude-standard` keeps `.gitignore` honoured, so `node_modules` and
 * `dist` do not arrive here.
 */
function scannableFiles() {
  const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8",
  });
  return out.split("\0").filter(Boolean);
}

const findings = [];

for (const file of scannableFiles()) {
  if (ALLOWLIST.has(file) || BINARY_EXT.test(file)) continue;

  let contents;
  try {
    if (statSync(file).size > MAX_BYTES) continue;
    contents = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  const lines = contents.split(/\r?\n/);
  for (const { name, re } of PATTERNS) {
    lines.forEach((line, i) => {
      if (re.test(line)) {
        findings.push({ file, line: i + 1, name });
      }
    });
  }
}

if (findings.length > 0) {
  console.error(`Secret scan FAILED: ${findings.length} finding(s).\n`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  ${f.name}`);
  }
  console.error("\nConstitution Principle IV: no secret may appear in the repository.");
  process.exit(1);
}

console.log(`Secret scan clean. ${scannableFiles().length} file(s) checked, staged or not.`);
