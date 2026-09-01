/**
 * What a returning visitor gets after a deploy.
 *
 * The PWA tests read `sw.js` as text and assert it contains the right lines:
 * that the cache is named after the build id, that activate deletes older
 * caches, that the new worker takes over immediately. Nothing ever ran it. So
 * the question that actually matters, whether somebody who visited last week
 * gets the new app or a stale shell, was answered by reading the source.
 *
 * This runs it. Build A is served and cached by the worker. Build B is then
 * deployed over it, with a different asset hash and A's asset REMOVED, which is
 * what a real deploy looks like: hashed filenames mean the old file is gone.
 * Then a visitor reloads.
 *
 * The failure this exists to catch is silent. A stale index.html referencing a
 * script that no longer exists is a blank page with no error, on the copy of
 * the app that strangers see.
 *
 * Correct behaviour, and what is asserted:
 *   1. The first load registers a worker and is controlled by it.
 *   2. Immediately after a deploy the visitor may still get A. That is normal
 *      and is not a bug: the page was served from cache before the new worker
 *      existed. What is NOT allowed is a broken page.
 *   3. By the second reload they must be on B.
 *   4. The page must render at every step. Never blank, never a half update.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import {
  readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, cpSync, renameSync, readdirSync,
} from "node:fs";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";

const DIST = new URL("../app/dist/", import.meta.url).pathname.replace(/^\//, "");
const PORT = 8801;
const CDP_PORT = 9483;
const CHROME =
  process.env["CHROME_PATH"] ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

if (!existsSync(DIST)) {
  console.error(`No build at ${DIST}. Run "npm run build:app" first.`);
  process.exit(2);
}

const work = mkdtempSync(join(tmpdir(), "mdsb-pwa-"));
const A = join(work, "a");
const B = join(work, "b");
cpSync(DIST, A, { recursive: true });
cpSync(DIST, B, { recursive: true });

/** Stamps a build so the running page can say which one it is. */
function brand(root, name) {
  const assets = join(root, "assets");
  const js = readdirSync(assets).find((f) => f.endsWith(".js"));
  if (js === undefined) throw new Error(`no js asset in ${root}`);
  const marker = `;globalThis.__BUILD__=${JSON.stringify(name)};`;
  writeFileSync(join(assets, js), marker + readFileSync(join(assets, js), "utf8"), "utf8");
  return js;
}

const jsA = brand(A, "A");
const jsB = brand(B, "B");

// Build B is a real deploy: a new hashed filename, and A's file gone.
const renamedB = jsB.replace(/index-([^.]+)\.js$/, "index-DEPLOYED2.js");
renameSync(join(B, "assets", jsB), join(B, "assets", renamedB));
const indexB = join(B, "index.html");
writeFileSync(indexB, readFileSync(indexB, "utf8").replaceAll(jsB, renamedB), "utf8");

// A new build stamps a new id into the worker, which is what renames its cache
// and therefore what makes the old one get deleted.
//
// MDSB_BREAK_SW=1 skips that stamp, which is how this gate is proved to work.
// A build that forgets to change the id reuses the same cache, activate deletes
// nothing, and cache-first then serves the old shell forever: the visitor is
// stuck on the previous version with no error anywhere. Run it that way and
// this gate must fail. If it passes, the gate is decorative.
const swB = join(B, "sw.js");
const swSource = readFileSync(swB, "utf8");
const idMatch = swSource.match(/const VERSION = "([^"]+)"/);
if (idMatch === null) throw new Error("sw.js has no stamped VERSION");
const breakIt = process.env["MDSB_BREAK_SW"] === "1";
if (breakIt) {
  // The worker that matters is the one ALREADY INSTALLED, not the one being
  // deployed. Build A's worker is in control while the visitor arrives, so it
  // is A's fetch handler that decides whether they ever see B. Breaking B's
  // worker changes nothing, which is the second thing this experiment taught
  // me and the reason the break is applied here.
  const swA = join(A, "sw.js");
  const naiveA = readFileSync(swA, "utf8").replace(
    /[ \t]*void fetch\(request\)[\s\S]*?\.catch\(\(\) => undefined\);\r?\n/,
    "",
  );
  writeFileSync(swA, naiveA, "utf8");
  // Two things have to go, and finding that out was worth the experiment.
  //
  // Reusing the old cache id alone does NOT break updating, which is not what
  // I expected. The worker answers from cache and refreshes in the background,
  // so even in the same cache the entries are overwritten with the new build
  // and the visitor self heals on the next load. The version stamp is the belt;
  // that background refresh is the braces, and the braces do the work.
  //
  // So the break has to be an ordinary naive cache-first worker: same cache
  // name, and answers from cache without ever refreshing. That is the shape
  // most hand written service workers have, and it strands a visitor on the
  // build they first saw, forever, with nothing in the console.
  // Tolerant of CRLF, because the working tree has it and the first version of
  // this regex ended in a literal \n and matched nothing.
  const naive = swSource.replace(
    /[ \t]*void fetch\(request\)[\s\S]*?\.catch\(\(\) => undefined\);\r?\n/,
    "",
  );
  if (naive === swSource) throw new Error("could not remove the background refresh");
  writeFileSync(swB, naive, "utf8");
  console.log(
    "MDSB_BREAK_SW=1: the installed worker is naive cache-first and the id never changes, on purpose.",
  );
} else {
  writeFileSync(swB, swSource.replace(idMatch[1], `${idMatch[1]}-deploy2`), "utf8");
}

let serving = A;
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};
let missed = [];
const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const file = join(serving, path === "/" ? "index.html" : path);
  if (!existsSync(file)) {
    // A real static host 404s a deleted asset. It does not fall back to the
    // shell, and pretending otherwise would hide the exact failure being hunted.
    missed.push(path);
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
    return;
  }
  res.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": "no-cache",
  });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const profile = mkdtempSync(join(tmpdir(), "mdsb-pwa-chrome-"));
const chrome = spawn(
  CHROME,
  ["--headless=new", `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
   "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank"],
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
        await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
        ws.onmessage = (e) => {
          const m = JSON.parse(e.data);
          if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
        };
        return;
      }
    } catch { /* not up yet */ }
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

/** Which build is running, whether a worker owns the page, and is it alive. */
async function state() {
  return JSON.parse(await evaluate(`JSON.stringify({
    build: globalThis.__BUILD__ ?? null,
    controlled: !!navigator.serviceWorker.controller,
    buttons: document.querySelectorAll('button').length,
    text: (document.body.innerText || '').trim().slice(0, 40),
  })`));
}

async function visit() {
  await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/` });
  await sleep(2200);
}

const problems = [];
const check = (ok, message) => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${message}`);
  if (!ok) problems.push(message);
};

try {
  await connect();
  await send("Page.enable");
  await send("Runtime.enable");

  console.log("\nfirst visit, build A");
  await visit();
  // The worker registers on load; give it a moment, then reload so the page is
  // actually controlled by it, which is what a returning visitor experiences.
  await sleep(1200);
  await visit();
  let s = await state();
  console.log(`  running ${s.build}, controlled=${s.controlled}, ${s.buttons} buttons`);
  check(s.build === "A", "serves build A before the deploy");
  check(s.controlled === true, "a service worker is controlling the page");
  check(s.buttons > 5, "the app rendered, rather than a blank shell");

  console.log("\ndeploying build B, and deleting A's asset from the server");
  serving = B;
  missed = [];

  console.log("\nfirst reload after the deploy");
  await visit();
  s = await state();
  console.log(`  running ${s.build}, controlled=${s.controlled}, ${s.buttons} buttons`);
  check(s.buttons > 5, "the app still rendered immediately after a deploy");
  check(s.build !== null, "the page is running some build, not a broken mix");

  console.log("\nsecond reload");
  await visit();
  s = await state();
  console.log(`  running ${s.build}, controlled=${s.controlled}, ${s.buttons} buttons`);
  check(s.build === "B", "the returning visitor is on the new build");
  check(s.buttons > 5, "and the new build rendered");

  // The first version of this gate asserted that nothing asks the server for
  // the asset a deploy removed, and it failed on exactly one request. That
  // assertion was wrong, and weakening it needs the reason written down rather
  // than quietly deleted.
  //
  // The worker answers from cache and then refreshes in the background. After a
  // deploy that refresh 404s once, because hashed filenames mean the old file
  // is genuinely gone. It cannot do harm: the refresh only writes to the cache
  // when `fresh.ok`, so a 404 is discarded rather than stored, and the visitor
  // was already served from cache before it ran. One discarded request is what
  // stale-while-revalidate costs, not a defect.
  //
  // What WOULD be a defect is that 404 poisoning the cache, so that is what is
  // asserted now: a third visit must still be the new build and must still
  // render. That is the property. The count stays visible as information.
  const stale = missed.filter((p) => p.includes(jsA.replace(/\.js$/, "")));
  console.log(`\n  background refreshes that 404'd on the removed asset: ${stale.length}`);

  console.log("\nthird visit, checking the failed refresh poisoned nothing");
  await visit();
  s = await state();
  console.log(`  running ${s.build}, controlled=${s.controlled}, ${s.buttons} buttons`);
  check(s.build === "B", "still on the new build after a refresh 404'd");
  check(s.buttons > 5, "and still rendering, so the 404 was not cached");
} finally {
  try { ws?.close(); } catch { /* gone */ }
  chrome.kill();
  server.close();
  for (const dir of [work, profile]) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* windows lock */ }
  }
}

if (problems.length > 0) {
  console.error(`\nPWA update gate FAILED:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("\nPWA update gate clean. A returning visitor gets the new build.");
