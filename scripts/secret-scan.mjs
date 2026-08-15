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

function trackedFiles() {
  const out = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  return out.split("\0").filter(Boolean);
}

const findings = [];

for (const file of trackedFiles()) {
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

console.log(`Secret scan clean. ${trackedFiles().length} tracked file(s) checked.`);
