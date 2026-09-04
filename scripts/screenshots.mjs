/**
 * The README's screenshots and demo animation, produced by driving the real app.
 *
 * A repository with no picture in it asks a stranger to imagine the product,
 * and most of them will not. This captures the built app in headless Chrome so
 * every image is the thing itself, at a known size, in both palettes, and can
 * be regenerated after any change rather than going stale in a folder.
 *
 * The Chrome plumbing is the same shape as `scripts/contrast.mjs` and
 * `scripts/pwa-update.mjs`: serve `app/dist`, launch Chrome with a throwaway
 * profile, drive it over CDP. Those two already carry a copy each, so this is
 * the third rather than the first, and the two of them are verification gates
 * that a media script has no business refactoring on its way past.
 *
 * The animation is recorded rather than staged: one loop screenshots on a
 * timer while another clicks and types through a real session, so what the GIF
 * shows is what the app did, at the speed it did it. ffmpeg turns the frames
 * into a GIF for the README and an MP4 for anywhere a GIF is too coarse.
 *
 * Usage, from PowerShell, with the app built:
 *   npm run shots
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = new URL("../app/dist/", import.meta.url).pathname.replace(/^\//, "");
const OUT = new URL("../docs/media/", import.meta.url).pathname.replace(/^\//, "");
const PORT = 8801;
const CDP_PORT = 9483;

const CHROME =
  process.env["CHROME_PATH"] ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FFMPEG = process.env["FFMPEG_PATH"] ?? "ffmpeg";

/** A phone, because that is the device this app was designed for. */
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };
/** Wide enough for the editor and the live preview to sit side by side. */
const DESKTOP = { width: 1180, height: 760, deviceScaleFactor: 1.5, mobile: false };
/** The demo records at 1x: 150 frames at 1.5x is a GIF nobody waits for. */
const DEMO = { width: 1180, height: 720, deviceScaleFactor: 1, mobile: false };

const FRAME_MS = 110;
const GIF_FPS = 9;
const GIF_WIDTH = 760;

if (!existsSync(ROOT)) {
  console.error(`No build at ${ROOT}. Run "npm run build:app" first.`);
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

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

const profile = mkdtempSync(join(tmpdir(), "mdsb-shots-"));
const frames = mkdtempSync(join(tmpdir(), "mdsb-frames-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
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
          // An exception inside a click handler is swallowed by the browser:
          // `node.click()` returns normally, so a step looks like it worked
          // while the screen never changed. Surfacing it here is the only way
          // that failure is visible from outside the page.
          if (m.method === "Runtime.exceptionThrown") {
            const d = m.params?.exceptionDetails;
            console.error(`  page error: ${d?.exception?.description ?? d?.text ?? "unknown"}`);
          }
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

const viewport = (v) => send("Emulation.setDeviceMetricsOverride", { ...v, screenWidth: v.width, screenHeight: v.height });
const scheme = (value) =>
  send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value }] });

async function capture(file) {
  const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const data = r.result?.data;
  if (data === undefined) throw new Error(`no image data for ${file}`);
  writeFileSync(file, Buffer.from(data, "base64"));
  return Buffer.from(data, "base64").length;
}

/**
 * A named step, so a run that silently did nothing cannot pass as a session.
 * Every helper below returns whether it found what it was told to act on, and
 * every caller routes through here, because a screenshot of the wrong screen
 * still looks like a screenshot.
 */
let missed = 0;
async function expect(what, ok) {
  if (ok === true) return;
  missed++;
  console.error(`  MISSED: ${what}`);
  // What was on screen instead, since the run is headless and the frame it
  // failed on is gone by the time anybody reads this.
  const labels = await evaluate(
    `[...document.querySelectorAll('label, .tabs button[aria-pressed="true"]')].map(n => (n.textContent||'').trim().slice(0, 40)).slice(0, 12).join(' | ')`,
  ).catch(() => "unavailable");
  console.error(`    on screen: ${labels}`);
}

const js = (value) => JSON.stringify(value);

/**
 * Clicks the first element matching a selector whose text matches a pattern.
 *
 * The blur is not decoration. `store.ts` defers every repaint for as long as a
 * field holds focus, deliberately, because rebuilding the interface under a
 * finger mid-word loses characters on Android. A real press moves focus first;
 * a programmatic `click()` does not, so without this the state changes and the
 * screen never catches up. It cost an afternoon: the tab reported itself
 * pressed, `history.state` said `export`, and the screenshot showed Build.
 */
async function clickText(selector, pattern, { pointer = false } = {}) {
  return evaluate(`(() => {
    const re = new RegExp(${js(pattern)});
    const n = [...document.querySelectorAll(${js(selector)})].find(x => re.test((x.textContent || '').trim()));
    if (!n) return false;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    n.scrollIntoView({ block: 'center' });
    ${pointer ? "if (window.__point) window.__point(n);" : ""}
    n.click();
    return true;
  })()`);
}

/** Opens a folded group by id, the way a press on its summary would. */
async function openGroup(id) {
  return evaluate(`(() => {
    const d = document.getElementById(${js(id)});
    if (!d) return false;
    d.open = true;
    return true;
  })()`);
}

/** The input or textarea whose visible label matches, addressed by its id. */
const FIELD_BY_LABEL = `(pattern, nth) => {
  const re = new RegExp(pattern);
  const labels = [...document.querySelectorAll('label')].filter(l => re.test((l.textContent || '').trim()));
  const label = labels[nth || 0];
  if (!label) return null;
  return document.getElementById(label.htmlFor);
}`;

/** Fills a field the way a person would: a value, then the event the app listens for. */
async function fill(labelPattern, value, nth = 0) {
  return evaluate(`(() => {
    const f = (${FIELD_BY_LABEL})(${js(labelPattern)}, ${String(nth)});
    if (!f) return false;
    f.scrollIntoView({ block: 'center' });
    f.value = ${js(value)};
    f.dispatchEvent(new Event('input', { bubbles: true }));
    f.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
}

/**
 * The same, one character at a time, for the animation.
 *
 * The field is looked up again for every character rather than held in a
 * variable. A repaint replaces the input, and appending to the node that used
 * to be there types into a detached element: the first attempt at this ended
 * with a price reading "$USD 140 per character", half of what was typed
 * spliced onto half of what was already in the field. It reports what actually
 * landed rather than that it finished, so the drift cannot pass silently a
 * second time.
 */
async function typeInto(labelPattern, value, nth = 0) {
  const at = `(${FIELD_BY_LABEL})(${js(labelPattern)}, ${String(nth)})`;

  const found = await evaluate(`(() => {
    const f = ${at};
    if (!f) return false;
    f.scrollIntoView({ block: 'center' });
    if (window.__point) window.__point(f);
    f.focus();
    f.value = '';
    f.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  if (found !== true) return false;

  for (const character of value) {
    const ok = await evaluate(`(() => {
      const f = ${at};
      if (!f) return false;
      if (document.activeElement !== f) f.focus();
      f.value += ${js(character)};
      f.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    if (ok !== true) return false;
    await sleep(55);
  }

  await evaluate(`(() => { const f = ${at}; if (f) f.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  return (await evaluate(`(() => { const f = ${at}; return f ? f.value : null; })()`)) === value;
}

async function scrollTo(selector) {
  return evaluate(`(() => {
    const n = document.querySelector(${js(selector)});
    if (!n) return false;
    n.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -12);
    return true;
  })()`);
}

const toTop = () => evaluate("window.scrollTo(0, 0); true");

/**
 * A pointer, drawn by the page, because headless Chrome screenshots contain no
 * cursor and an animation where controls operate themselves reads as a bug.
 * Stills do not get one: a frozen cursor in a still is clutter.
 */
const POINTER = `(() => {
  const dot = document.createElement('div');
  dot.id = '__pointer';
  dot.style.cssText = [
    'position:fixed', 'z-index:2147483647', 'width:22px', 'height:22px',
    'margin:-11px 0 0 -11px', 'border-radius:50%', 'pointer-events:none',
    'background:rgba(37,99,235,0.28)', 'border:2px solid rgba(37,99,235,0.9)',
    'box-shadow:0 0 0 0 rgba(37,99,235,0.45)',
    'transition:left .28s ease, top .28s ease, transform .12s ease',
    'left:50%', 'top:60%',
  ].join(';');
  document.body.appendChild(dot);
  window.__point = (node) => {
    const r = node.getBoundingClientRect();
    dot.style.left = (r.left + Math.min(r.width / 2, 90)) + 'px';
    dot.style.top = (r.top + r.height / 2) + 'px';
    dot.style.transform = 'scale(0.7)';
    setTimeout(() => { dot.style.transform = 'scale(1)'; }, 160);
  };
  return true;
})()`;

async function load({ pointer = false } = {}) {
  await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/` });
  await sleep(2200);
  if (pointer) await evaluate(POINTER);
}

/** Loads the bundled example storefront: twelve sections of real content. */
async function loadExample() {
  const ok = await clickText("#surface button", "See an example page");
  await sleep(1600);
  return ok;
}

/* ------------------------------------------------------------------ stills */

async function stills() {
  await viewport(PHONE);
  await scheme("light");

  // 1. What a stranger sees on arrival, with the templates unfolded, because
  //    the folded version is a screenshot of one closed summary line.
  await load();
  await expect("empty state", await openGroup("starters-group-empty"));
  await sleep(400);
  await capture(join(OUT, "01-start.png"));

  // 2. A real page as a list of sections, which is the whole editing model.
  await expect("example page", await loadExample());
  await toTop();
  await sleep(400);
  await capture(join(OUT, "02-sections.png"));

  // 3. One section open. The prices section, since it is the one with fields
  //    worth looking at rather than a single box of text.
  await expect("open a prices section", await clickText("#surface .blocks > li button", "^Open Prices"));
  await sleep(700);
  await expect("scroll to the form", await scrollTo("#surface .blocks > li .bulk-toolbar"));
  await sleep(300);
  await capture(join(OUT, "03-editing.png"));

  // 4. Bulk pricing, which needs costs to work on. Two rows are enough to show
  //    both what it does and what it refuses to guess at: the other rows have
  //    no cost recorded, and the panel says so rather than inventing one.
  //
  //    "Add" is filled with 0 deliberately. Blank means "not decided yet" and
  //    computes nothing at all, by design, so a blank there is a panel with no
  //    preview in it. See computeBulkPreview in app/src/ui/bulk-pricing.ts.
  await expect("first cost", await fill("What you paid", "48", 0));
  await sleep(350);
  await expect("second cost", await fill("What you paid", "82", 1));
  await sleep(350);
  await expect("select all", await clickText("#surface .bulk-toolbar button", "^Select all$"));
  await sleep(500);
  await expect("multiplier", await fill("Multiply cost by", "4.2"));
  await sleep(300);
  await expect("addition", await fill("^Add$", "0"));
  await sleep(300);
  await expect("rounding", await fill("Round up to", "99"));
  await sleep(600);
  await expect("scroll to the panel", await scrollTo("#surface .bulk-apply"));
  await sleep(300);
  await capture(join(OUT, "04-pricing.png"));

  // 5. The preview, at the price table, because a table is the thing an artist
  //    would otherwise be learning Markdown in order to write.
  await load();
  await expect("preview tab", await clickText(".tabs button", "^Preview$"));
  await sleep(900);
  await expect("scroll to a table", await scrollTo("#surface .rendered table"));
  await sleep(300);
  await capture(join(OUT, "05-preview.png"));

  // 6. The output, the host picker, and what to do with the text.
  await expect("copy tab", await clickText(".tabs button", "^Copy$"));
  await sleep(700);
  await toTop();
  await sleep(300);
  await capture(join(OUT, "06-copy.png"));

  // 7. The dark palette, which ships and is therefore half the users.
  await scheme("dark");
  await load();
  await sleep(400);
  await capture(join(OUT, "07-dark.png"));

  // 8 and 9. The wide layout, where the preview earns a column of its own.
  for (const value of ["light", "dark"]) {
    await viewport(DESKTOP);
    await scheme(value);
    await load();
    await expect(`wide ${value}: open a section`, await clickText("#surface .blocks > li button", "^Open Prices"));
    await sleep(800);
    await toTop();
    await sleep(300);
    await capture(join(OUT, `0${value === "light" ? "8" : "9"}-wide-${value}.png`));
  }

  // 10. The warnings, which are the product's actual selling point and which a
  //     correct page does not produce. So one is provoked the way a real person
  //     provokes it: a picture named by a path on their own computer rather
  //     than by a web address. Left until last, since it edits the saved page.
  await viewport(PHONE);
  await scheme("light");
  await load();
  await expect("open the gallery", await clickText("#surface .blocks > li button", "^Open Gallery"));
  await sleep(700);
  await expect("a picture that is not online", await fill("Image address", "photos/banner-final-2.png"));
  await sleep(900);
  await expect("preview tab", await clickText(".tabs button", "^Preview$"));
  await sleep(900);
  await toTop();
  await sleep(300);
  await capture(join(OUT, "10-warnings.png"));
}

/* -------------------------------------------------------------------- demo */

/**
 * The animation: an empty page, a template, an edit, and the Markdown out.
 *
 * Recorded live. `record` screenshots on a timer while `perform` drives the
 * app, so the frames carry the app's own timing, including the debounce
 * between a keystroke and the preview catching up.
 */
async function demo() {
  await viewport(DEMO);
  await scheme("light");
  await load({ pointer: true });

  let recording = true;
  let n = 0;
  const record = (async () => {
    while (recording) {
      const started = Date.now();
      try {
        await capture(join(frames, `frame-${String(++n).padStart(4, "0")}.png`));
      } catch {
        n--; // A frame lost to a repaint is not worth failing the run over.
      }
      const left = FRAME_MS - (Date.now() - started);
      if (left > 0) await sleep(left);
    }
  })();

  const perform = (async () => {
    await sleep(900);
    await expect("demo: templates", await clickText("#surface summary", "Start from a template", { pointer: true }));
    await sleep(1200);
    await expect("demo: art commissions", await clickText("#surface .starters button", "^Art commissions", { pointer: true }));
    await sleep(2000);
    await toTop();
    await sleep(900);

    await expect("demo: open prices", await clickText("#surface .blocks > li button", "^Open Prices", { pointer: true }));
    await sleep(1200);
    await expect("demo: type a price", await typeInto("^Price$", "USD 140"));
    // Nothing repaints while a field has focus, on purpose, so the preview
    // beside it is still showing the old price at this moment. Letting go is
    // what makes it catch up, and that is the beat worth filming.
    await evaluate("document.activeElement instanceof HTMLElement && document.activeElement.blur()");
    await sleep(1800);

    await expect("demo: copy tab", await clickText(".tabs button", "^Copy$", { pointer: true }));
    await sleep(1800);
    await toTop();
    await sleep(1200);
    await expect("demo: choose a host", await fill("Where you will paste this", "text.is"));
    await sleep(1800);
  })();

  await perform;
  recording = false;
  await record;
  console.log(`  recorded ${String(n)} frames`);
  return n;
}

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-800)))));
  });
}

async function encode() {
  const input = join(frames, "frame-%04d.png");
  const palette = join(frames, "palette.png");
  const scale = `fps=${String(GIF_FPS)},scale=${String(GIF_WIDTH)}:-1:flags=lanczos`;

  await ffmpeg(["-y", "-framerate", String(GIF_FPS), "-i", input, "-vf", `${scale},palettegen=max_colors=128:stats_mode=diff`, palette]);
  await ffmpeg([
    "-y", "-framerate", String(GIF_FPS), "-i", input, "-i", palette,
    "-lavfi", `${scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`,
    "-loop", "0", join(OUT, "demo.gif"),
  ]);
  // The same session as video, for anywhere a 128 colour GIF is not enough.
  // yuv420p and an even width, because odd dimensions are not encodable in
  // H.264 and half the players in the world only speak H.264.
  await ffmpeg([
    "-y", "-framerate", String(GIF_FPS), "-i", input,
    "-vf", "scale=1180:-2:flags=lanczos,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-movflags", "+faststart",
    join(OUT, "demo.mp4"),
  ]);
}

/* -------------------------------------------------------------------- main */

try {
  await connect();
  await send("Page.enable");
  await send("Runtime.enable");

  // `node scripts/screenshots.mjs demo` records only the animation, which is
  // the half worth re-running while its timing is being tuned.
  const only = process.argv[2];

  if (only !== "demo") {
    console.log("Stills:");
    await stills();
  }
  if (only !== "stills") {
    console.log("Demo:");
    await demo();
    console.log("Encoding:");
    await encode();
  }
} finally {
  try {
    ws?.close();
  } catch {
    /* already gone */
  }
  chrome.kill();
  server.close();
  for (const dir of [profile, frames]) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* windows sometimes holds the profile briefly */
    }
  }
}

if (missed > 0) {
  console.error(`\n${String(missed)} step(s) found nothing to act on. The images above are of the wrong screen.`);
  process.exit(1);
}
console.log(`\nWrote images and the demo to ${OUT}`);
