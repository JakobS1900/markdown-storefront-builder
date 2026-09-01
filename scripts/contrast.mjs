/**
 * Colour contrast, measured in a browser that actually lays the page out.
 *
 * The a11y gate runs axe-core under jsdom, which has no layout and no computed
 * colours, so `color-contrast` is switched off there. That was the honest thing
 * to do, and it left the project's one real accessibility claim resting on a
 * manual pass nobody can rerun. This closes it.
 *
 * Headless Chrome, the built app, axe with ONLY the contrast rule enabled, run
 * twice: once in light and once in dark. Both palettes ship, so testing one is
 * testing half the users.
 *
 * The page under test is not the empty shell. An empty page has almost no
 * coloured text on it, so it would pass while proving nothing. This loads the
 * bundled example storefront and opens a section, which puts headings, hints,
 * warnings, buttons, table text and the danger colour on screen together.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";

const ROOT = new URL("../app/dist/", import.meta.url).pathname.replace(/^\//, "");
const AXE = new URL("../node_modules/axe-core/axe.min.js", import.meta.url).pathname.replace(/^\//, "");
const PORT = 8799;
const CDP_PORT = 9481;

const CHROME =
  process.env["CHROME_PATH"] ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

if (!existsSync(ROOT)) {
  console.error(`No build at ${ROOT}. Run "npm run build:app" first.`);
  process.exit(2);
}

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
  let file = join(ROOT, path === "/" ? "index.html" : path);
  if (!existsSync(file)) file = join(ROOT, "index.html");
  try {
    const body = readFileSync(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const profile = mkdtempSync(join(tmpdir(), "mdsb-contrast-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    // A phone, because that is what this is built for and what wraps text.
    "--window-size=390,844",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
let nextId = 1;
const pending = new Map();

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      const page = tabs.find((t) => t.type === "page");
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((res, rej) => {
          ws.onopen = res;
          ws.onerror = rej;
        });
        ws.onmessage = (e) => {
          const m = JSON.parse(e.data);
          if (m.id && pending.has(m.id)) {
            pending.get(m.id)(m);
            pending.delete(m.id);
          }
        };
        return;
      }
    } catch {
      /* chrome not up yet */
    }
    await sleep(250);
  }
  throw new Error("headless Chrome did not start");
}

const send = (method, params = {}) => {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((r) => pending.set(id, r));
};

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  const thrown = r.result?.exceptionDetails;
  if (thrown) throw new Error(thrown.exception?.description ?? thrown.text ?? "evaluate failed");
  return r.result?.result?.value;
}

/** Puts real, coloured content on screen: the bundled example storefront. */
async function loadRealContent() {
  await evaluate(`(async () => {
    const b = [...document.querySelectorAll('button')].find(x => /example page/i.test(x.textContent || ''));
    if (b) b.click();
  })()`);
  await sleep(1500);
  // Open the first section too, so form labels, hints and the danger colour
  // are all rendered rather than only the list.
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('#surface button')].find(x => /^Open /.test((x.textContent||'').trim()));
    if (b) b.click();
  })()`);
  await sleep(900);
}

async function auditScheme(scheme) {
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: scheme }],
  });
  await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/` });
  await sleep(2500);
  await loadRealContent();

  await evaluate(readFileSync(AXE, "utf8"));
  const result = await evaluate(`(async () => {
    const r = await axe.run(document.body, {
      runOnly: { type: 'rule', values: ['color-contrast'] },
      resultTypes: ['violations'],
    });
    return JSON.stringify({
      violations: r.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map(n => ({
          target: n.target.join(' '),
          summary: (n.failureSummary || '').split('\\n').filter(Boolean).slice(-1)[0] || '',
          html: (n.html || '').slice(0, 90),
        })),
      })),
      checked: document.querySelectorAll('*').length,
      // Structural counts rather than a text sample. These are what prove the
      // run measured a real storefront and not the empty shell.
      sections: document.querySelectorAll('#surface li').length,
      fields: document.querySelectorAll('#surface input, #surface textarea, #surface select').length,
      hints: document.querySelectorAll('#surface .hint').length,
    });
  })()`);
  return JSON.parse(result);
}

let failed = 0;
try {
  await connect();
  await send("Page.enable");
  await send("Runtime.enable");

  for (const scheme of ["light", "dark"]) {
    const { violations, checked, sections, fields, hints } = await auditScheme(scheme);
    const nodes = violations.flatMap((v) => v.nodes);
    console.log(
      `\n${scheme}: ${checked} elements, ${sections} sections, ${fields} fields, ${hints} hints, ${nodes.length} contrast failure(s)`,
    );

    // A run that measured the empty shell would pass and prove nothing, which
    // is the trap three tests fell into earlier in this project. The example
    // storefront has several sections and an opened one has several fields, so
    // this refuses to report a pass it did not earn.
    if (sections < 3 || fields < 3) {
      console.error(
        `  ${scheme}: only ${sections} sections and ${fields} fields on screen. The example page did not load, so this run proves nothing.`,
      );
      failed++;
    }
    for (const n of nodes) {
      failed++;
      console.log(`  ${n.target}`);
      console.log(`    ${n.summary}`);
      console.log(`    ${n.html}`);
    }
  }
} finally {
  try {
    ws?.close();
  } catch {
    /* already gone */
  }
  chrome.kill();
  server.close();
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* windows sometimes holds the profile briefly */
  }
}

if (failed > 0) {
  console.error(`\nContrast gate FAILED: ${failed} element(s) below the WCAG AA ratio.`);
  process.exit(1);
}
console.log("\nContrast gate clean. Light and dark both pass WCAG AA.");
