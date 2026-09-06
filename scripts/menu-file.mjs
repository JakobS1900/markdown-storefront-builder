/**
 * The saved menu file, measured in a browser that lays it out.
 *
 * The file is the one thing this project produces that other people open
 * directly, and until this existed nothing checked what it looks like when they
 * do. `menu-file.ts` inlines a copy of the stylesheet, the unit tests assert
 * that the copy is there, and jsdom lays nothing out, so FR-073 and SC-007
 * ("reflows, does not scroll sideways at 390 CSS pixels") were asserted by
 * nobody at all.
 *
 * That is the same gap `e0f345b` had to close for the preview table, where a
 * `min-width` floor on the cells gave every column exactly the floor, and a
 * floor on the table set the whole page scrolling sideways. Both mistakes are
 * invisible to every test that does not lay the page out.
 *
 * So: build the real file, from the bundled example storefront, through the
 * real save control, then open it at 390 CSS pixels wide and measure it.
 *
 * IT REFUSES TO REPORT A PASS IT DID NOT EARN. A file with nothing in it would
 * not scroll sideways and would have no accessibility violations, which is a
 * green gate measuring nothing. This project has made that mistake three times
 * in one afternoon, so the run has to prove it saw a heading, a table and a
 * picture before it is allowed to say the word "clean".
 *
 * HERMETIC ON PURPOSE. The example page's pictures are at placehold.co. Reading
 * them would make this gate need the internet, need that service to be up, and
 * need it to allow a cross origin read, so a gate that is meant to measure a
 * layout would fail for three reasons that have nothing to do with layout.
 * The server below rewrites those addresses to an icon it serves itself, so the
 * pictures are real bytes, embedded through the real code path, from this
 * machine. It fails if there was nothing to rewrite, because that would mean
 * the example changed and the pictures quietly went away.
 *
 * `MDSB_BREAK_MENUFILE=1` is the self test. It takes the scroll rule out of the
 * file's own stylesheet, which is exactly the regression above, and the gate
 * must then fail.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../app/dist/", import.meta.url));
const AXE = fileURLToPath(new URL("../node_modules/axe-core/axe.min.js", import.meta.url));
const PORT = 8805;
const CDP_PORT = 9487;

/** Where the produced file is served from, so the browser opens it over http. */
const MENU_PATH = "/produced-menu-file.html";

/** The width the whole project measures against: a phone, in CSS pixels. */
const WIDTH = 390;

const BREAK = process.env["MDSB_BREAK_MENUFILE"] === "1";

const CHROME =
  process.env["CHROME_PATH"] ??
  (process.platform === "win32"
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : "google-chrome");

if (!existsSync(ROOT)) {
  console.error(`No build at ${ROOT}. Run "npm run build:app" first.`);
  process.exit(2);
}

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

/** Filled in once the app has produced the file. */
let produced = "";
let rewritten = 0;

const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]);

  if (path === MENU_PATH) {
    res.writeHead(200, { "content-type": "text/html" }).end(produced);
    return;
  }

  let file = join(ROOT, path === "/" ? "index.html" : path);
  if (!existsSync(file)) file = join(ROOT, "index.html");

  try {
    if (path === "/example.json") {
      const source = readFileSync(file, "utf8");
      const local = `"http://127.0.0.1:${PORT}/icon-192.png"`;
      const body = source.replace(/"https:\/\/placehold\.co\/[^"]*"/g, () => {
        rewritten += 1;
        return local;
      });
      res.writeHead(200, { "content-type": "application/json" }).end(body);
      return;
    }
    const body = readFileSync(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const profile = mkdtempSync(join(tmpdir(), "mdsb-menu-file-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    `--window-size=${WIDTH},844`,
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

/**
 * Waits for something to be true rather than for a length of time.
 *
 * Taken from `scripts/contrast.mjs`, where fixed sleeps in front of
 * asynchronous work made the gate look flaky three times in one session under
 * the load of a full `npm run verify`. Throwing on the deadline is deliberate:
 * a gate that gives up quietly is the vacuous pass this file exists to refuse.
 */
async function waitFor(expression, what, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if ((await evaluate(expression)) === true) return;
    if (Date.now() > deadline) throw new Error(`timed out after ${timeoutMs}ms waiting for ${what}`);
    await sleep(100);
  }
}

/** Loads the bundled example storefront, the same way the contrast gate does. */
async function loadExample() {
  // Waited for rather than slept in front of. `#app` is in the static markup,
  // so it exists before the bundle has drawn anything into it: a click issued
  // then finds no button, nothing happens, and the wait below times out
  // reporting that the example never loaded.
  await waitFor(
    `[...document.querySelectorAll('button')].some(x => /example page/i.test(x.textContent || ''))`,
    "the app to offer the example page",
  );
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => /example page/i.test(x.textContent || ''));
    if (b) b.click();
  })()`);
  await waitFor(
    `document.querySelectorAll('#surface .blocks > li').length >= 3`,
    "the example page to put its sections on screen",
  );
}

/**
 * Produces the file the way a seller does: by pressing the button.
 *
 * The bytes are taken where the app hands them over rather than by reaching
 * into a module, so what is measured below is what `handOff` would have written
 * to the device. Downloads are denied at the browser so the click cannot
 * navigate this page away while its result is being read.
 */
async function produceMenuFile() {
  await evaluate(`(() => {
    const tab = [...document.querySelectorAll('.tabs button')].find(x => /^Copy$/.test((x.textContent||'').trim()));
    if (tab) tab.click();
  })()`);
  await waitFor(
    `[...document.querySelectorAll('#surface button')].some(x => /menu/i.test(x.textContent || ''))`,
    "the Copy tab to offer the menu file control",
  );

  await evaluate(`(() => {
    window.__menuFile = null;
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { window.__menuFile = blob.text(); return original(blob); };
    const b = [...document.querySelectorAll('#surface button')].find(x => /menu/i.test(x.textContent || ''));
    b.click();
    return true;
  })()`);

  await waitFor(`window.__menuFile !== null`, "the save control to produce a file");
  return await evaluate(`window.__menuFile`);
}

/** Opens the produced file at phone width and reads what it actually does. */
async function measure() {
  // `mobile: false` on purpose, and it took a failed self test to find out why.
  // With mobile emulation on, a page wider than the screen makes Chrome widen
  // the layout viewport to the content instead of overflowing it, so
  // `scrollWidth` and `innerWidth` both read 583 and comparing them said the
  // page fitted. They agreed because the viewport had moved, which is the one
  // thing a fixed measurement must not do. The width below is the ruler, and
  // the page is measured against it.
  await send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url: `http://127.0.0.1:${PORT}${MENU_PATH}` });
  await waitFor(`document.readyState === 'complete'`, "the menu file to load");
  // The renderer marks pictures `loading="lazy"`, which is right for a reader
  // and wrong for a measurement: one below the fold never loads, never reports
  // `complete`, and the wait below sits there until it gives up. Asking for
  // them eagerly starts the ones that were deferred.
  await evaluate(`(() => { for (const i of document.images) i.loading = 'eager'; return true; })()`);
  await waitFor(
    `[...document.images].every(i => i.complete)`,
    "the embedded pictures to decode",
  );

  await evaluate(readFileSync(AXE, "utf8"));
  const result = await evaluate(`(async () => {
    const r = await axe.run(document, {
      // The rules that are a standard rather than a preference. Best practice
      // rules are left out on purpose: they want a landmark structure and a
      // single h1, which are right for an application and wrong for a document
      // whose headings are the seller's own.
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
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
      pageWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      // What proves a real page was measured. A file with none of these would
      // pass every check above and mean nothing.
      headings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
      tables: document.querySelectorAll('table').length,
      images: document.querySelectorAll('img').length,
      imagesWithAlt: [...document.querySelectorAll('img')].filter(i => (i.getAttribute('alt') || '').trim() !== '').length,
      embedded: [...document.querySelectorAll('img')].filter(i => i.currentSrc.startsWith('data:')).length,
      // A wide table has to scroll inside its own wrapper. If the wrapper is
      // not the thing overflowing, the page is.
      scrollers: [...document.querySelectorAll('.table-scroll')].filter(e => e.scrollWidth > e.clientWidth).length,
    });
  })()`);
  return JSON.parse(result);
}

let failed = 0;
try {
  await connect();
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Browser.setDownloadBehavior", { behavior: "deny" });

  await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/` });
  await loadExample();

  produced = await produceMenuFile();
  if (typeof produced !== "string" || produced === "") {
    throw new Error("the save control produced no file");
  }

  if (BREAK) {
    // The self test. Taking the scroll rule out of the file's own stylesheet
    // leaves a table with a 34rem floor inside a 390px page, which is the
    // regression this gate exists to catch. Breaking the app instead would
    // prove nothing about the file, which is the thing under test.
    produced = produced.replace("overflow-x: auto;", "overflow-x: visible;");
    console.log("MDSB_BREAK_MENUFILE=1: the scroll wrapper has been disabled in the produced file.");
  }

  const bytes = Buffer.byteLength(produced, "utf8");
  const kept = join(profile, "menu.html");
  writeFileSync(kept, produced, "utf8");

  const m = await measure();
  const nodes = m.violations.flatMap((v) => v.nodes.map((n) => ({ ...n, id: v.id })));

  console.log(
    `\nmenu file: ${(bytes / 1024).toFixed(1)} KB, ${m.headings} heading(s), ${m.tables} table(s), ` +
      `${m.images} picture(s) of which ${m.embedded} embedded and ${m.imagesWithAlt} described`,
  );
  console.log(`page width ${m.pageWidth}px in a ${m.viewport}px viewport, ${m.scrollers} table(s) scrolling inside their wrapper`);

  if (rewritten === 0) {
    console.error(
      "  the example page has no pictures to rewrite, so this run measured a page with none. Check app/public/example.json.",
    );
    failed++;
  }

  // FR-073 and SC-007. The page itself must not scroll sideways; a wide table
  // scrolls inside its wrapper instead. Measured against the fixed width rather
  // than against whatever the viewport ended up as, for the reason above.
  if (m.pageWidth > WIDTH || m.viewport !== WIDTH) {
    console.error(
      `  the page is ${m.pageWidth}px wide in a ${m.viewport}px viewport at a ruler of ${WIDTH}px, so a reader has to scroll sideways to read the menu.`,
    );
    failed++;
  }

  // The guard against a green gate that measured nothing.
  if (m.headings < 1 || m.tables < 1 || m.images < 1) {
    console.error(
      `  only ${m.headings} headings, ${m.tables} tables and ${m.images} pictures were on screen, so this run proves nothing.`,
    );
    failed++;
  }

  // What the contract promises about the file: real headings, a real table,
  // and alt text carried through from the compiled output.
  if (m.imagesWithAlt < m.images) {
    console.error(`  ${m.images - m.imagesWithAlt} picture(s) reached the file with no alt text.`);
    failed++;
  }

  for (const n of nodes) {
    failed++;
    console.log(`  ${n.id}: ${n.target}`);
    console.log(`    ${n.summary}`);
    console.log(`    ${n.html}`);
  }

  if (failed > 0) console.error(`\nThe file measured is kept at ${kept}`);
} finally {
  try {
    ws?.close();
  } catch {
    /* already gone */
  }
  chrome.kill();
  server.close();
  if (failed === 0) {
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* windows sometimes holds the profile briefly */
    }
  }
}

if (failed > 0) {
  console.error(`\nMenu file gate FAILED: ${failed} problem(s) with the saved file.`);
  process.exit(1);
}
console.log("\nMenu file gate clean. The saved file reflows at 390px and axe finds nothing in it.");
