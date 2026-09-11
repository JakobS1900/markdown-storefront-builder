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
import { fileURLToPath } from "node:url";

// fileURLToPath rather than trimming a leading slash off `pathname`. That trick
// is right on Windows, where the pathname is "/F:/repo/app/dist/", and wrong
// everywhere else: on the Linux CI runner it turned "/home/runner/..." into the
// relative "home/runner/...", so this gate reported "No build at ..." and
// exited 2 on every push to master while passing on the laptop that wrote it.
const ROOT = fileURLToPath(new URL("../app/dist/", import.meta.url));
const AXE = fileURLToPath(new URL("../node_modules/axe-core/axe.min.js", import.meta.url));
const PORT = 8799;
const CDP_PORT = 9481;
// Named once because the origin has to be spelled the same way twice: the URL
// the page is navigated to, and the origin whose storage is cleared before it.
// A clear that names a slightly different origin succeeds, clears nothing, and
// leaves the second scheme warm without saying so.
const ORIGIN = `http://127.0.0.1:${PORT}`;

// The default is per platform, not per author's laptop. A Windows path handed
// to spawn on Linux fails as ENOENT and then as "headless Chrome did not
// start", which reads like a broken runner rather than a wrong filename.
// CHROME_PATH overrides both.
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

/**
 * Waits for something to be true, rather than for a length of time.
 *
 * The two waits below were fixed sleeps in front of asynchronous work: a click
 * that fetches the example document and writes it to IndexedDB before anything
 * appears. 1500ms was enough on a quiet machine and not enough under the load
 * of a full `npm run verify`, where this runs straight after the whole test
 * suite. The light run goes first, so the light run is the cold one, and it was
 * the one that reported `0 sections` and made the guard refuse a pass. Three
 * times in one session on 2026-09-05, every time inside `verify` and never once
 * when re-run alone, which is exactly what made it look like a flake in the
 * gate rather than a fixed wait that was too short.
 *
 * Throwing on the deadline is deliberate. A gate that gives up quietly is the
 * vacuous pass this file exists to refuse.
 */
async function waitFor(expression, what, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if ((await evaluate(expression)) === true) return;
    if (Date.now() > deadline) throw new Error(`timed out after ${timeoutMs}ms waiting for ${what}`);
    await sleep(100);
  }
}

/** Puts real, coloured content on screen: the bundled example storefront. */
async function loadRealContent() {
  // The waits below were made real; the CLICKS in front of them were left as a
  // fixed sleep, and that is the same bug one layer up. `#app` is in the static
  // markup, so `sleep(2500)` after navigating can end before the bundle has
  // drawn the button: the click then finds nothing, nothing happens, and the
  // wait times out reporting that the example never loaded. Seen inside
  // `npm run verify` on 2026-09-06, passing on its own immediately afterwards,
  // which is precisely the signature this file's own docstring describes.
  //
  // Either state, not just the first one. The two schemes run in one browser
  // with one profile, so the dark run reopens an app that already has the
  // example saved in IndexedDB and therefore no longer offers it: waiting only
  // for the button made the light run pass and the dark run time out. The
  // original click-if-present was tolerant of that by accident; this is
  // tolerant of it on purpose.
  await waitFor(
    `document.querySelectorAll('#surface .blocks > li').length >= 3
      || [...document.querySelectorAll('button')].some(x => /example page/i.test(x.textContent || ''))`,
    "the app to open the example or offer it",
  );
  await evaluate(`(async () => {
    const b = [...document.querySelectorAll('button')].find(x => /example page/i.test(x.textContent || ''));
    if (b) b.click();
  })()`);
  // The same counts the guard below checks, so what is waited for and what is
  // demanded cannot drift apart.
  await waitFor(
    `document.querySelectorAll('#surface .blocks > li').length >= 3`,
    "the example page to put its sections on screen",
  );
  // Open the first section too, so form labels, hints and the danger colour
  // are all rendered rather than only the list. Waited for first, for the
  // reason above.
  await waitFor(
    `document.querySelectorAll('#surface input, #surface textarea, #surface select').length >= 3
      || [...document.querySelectorAll('#surface button')].some(x => /^Open /.test((x.textContent||'').trim()))`,
    "a section to be open or to offer to open",
  );
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('#surface button')].find(x => /^Open /.test((x.textContent||'').trim()));
    if (b) b.click();
  })()`);
  await waitFor(
    `document.querySelectorAll('#surface input, #surface textarea, #surface select').length >= 3`,
    "a section to open its fields",
  );

  // And then the Prices section specifically, and every fold inside it.
  //
  // The step above opens whichever section offers itself first, which on the
  // example is a Text block: one field, no rows, and no folds at all. So this
  // gate has been reporting three fields and calling that an opened section,
  // while the richest surface in the app went unmeasured. Not the price rows,
  // not the row tools, not the cost, the unit, the quantity breakdown, the
  // labelled details, and not the two selling mode controls from feature 026.
  //
  // Measured before the fix: 0 details anywhere under '#surface', 3 fields.
  // That is the same failure the pages panel below records, found by probing
  // what the run had actually laid out rather than by trusting that opening
  // "a section" meant opening a representative one.
  //
  // Folds are opened by setting the property rather than by clicking each
  // summary, because the shell's group restore only ever opens a group, so this
  // survives the repaints that follow.
  await waitFor(
    `[...document.querySelectorAll('#surface button')].some(x => /^Open Prices/.test((x.textContent||'').trim()))
      || document.querySelectorAll('#surface fieldset.item').length >= 1`,
    "the example to offer its Prices section",
  );
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('#surface button')].find(x => /^Open Prices/.test((x.textContent||'').trim()));
    if (b) b.click();
  })()`);
  await waitFor(
    `document.querySelectorAll('#surface fieldset.item').length >= 1`,
    "the Prices section to draw its rows",
  );
  await evaluate(`(() => {
    for (const d of document.querySelectorAll('#surface details')) d.open = true;
  })()`);
  await waitFor(
    `document.querySelectorAll('#surface details[open] .field').length >= 5`,
    "the folded fields to be on screen",
  );

  // And the pages panel, which is a surface of its own since feature 025.
  //
  // It moved out of the Build surface into a drawer, and this gate measured 164
  // elements before that and 137 after: twenty seven pieces of coloured text
  // quietly stopped being checked. Nothing failed, because a gate that measures
  // less does not complain about it. It reuses the same tokens as everything
  // else, which is an argument rather than evidence, and this project's rule is
  // that a gate is worth what it measures.
  //
  // The guard below demands the panel, so this cannot drift back to unmeasured
  // without the gate refusing to report a pass.
  await waitFor(
    `!!document.querySelector('.bar [aria-controls="pages-panel"]')
      || !!document.querySelector('.pages-panel')`,
    "the app to offer or already show the pages panel",
  );
  await evaluate(`(() => {
    const t = document.querySelector('.bar [aria-controls="pages-panel"]');
    if (t) t.click();
  })()`);
  await waitFor(`!!document.querySelector('.pages-panel .pages li')`, "the pages panel to list a page");
}

/**
 * Puts axe on the page, once per page load.
 *
 * Called by the wizard pass and again by the storefront pass, which run against
 * the same document. Injecting the whole library twice is a quarter of a
 * megabyte of source evaluated for nothing, and it would silently discard any
 * state axe holds. A navigation clears `window`, so this injects once per
 * scheme and the second caller finds it already there.
 */
async function injectAxe() {
  if ((await evaluate("typeof window.axe !== 'undefined'")) === true) return;
  await evaluate(readFileSync(AXE, "utf8"));
}

/**
 * How many questions the wizard asks, READ OFF THE WIZARD RATHER THAN TYPED.
 *
 * This was `const WIZARD_QUESTIONS = 6` and that was R6's own failure mode
 * reintroduced inside the gate written to prevent it. Every guard below is a
 * `<` comparison against it, so a seventh question would have been walked as
 * six screens, counted six help lines against a threshold of six, and reported
 * a pass while leaving a whole new screen unmeasured. A gate that measures less
 * does not complain about it, and a hardcoded total is how it comes to measure
 * less. Found by the holistic review at T048.
 *
 * The progress line already prints the total on screen one, "Question 1 of 6",
 * so the number is there to be read and does not need a second copy here.
 * `app/tests/a11y.test.ts` solves the same problem by importing `QUESTION_COUNT`
 * from the module; a browser gate cannot import, but it can look.
 */
const QUESTION_TOTAL = `(() => {
  const line = document.querySelector('#wizard-panel .wizard-progress');
  const found = /Question \\d+ of (\\d+)/.exec(line ? line.textContent || '' : '');
  return found === null ? 0 : Number(found[1]);
})()`;

/**
 * Everything one wizard screen is worth: its contrast, its parts, its width.
 *
 * One evaluate rather than three, because all three describe the SAME screen
 * and the wizard repaints on every press. Asking separately would let a repaint
 * land between the questions and produce three answers about two screens.
 */
const WIZARD_SCREEN = `(async () => {
  const panel = document.querySelector('#wizard-panel');
  const layer = document.querySelector('.wizard');
  const page = document.documentElement;

  // WAIT FOR THE PANEL TO STOP MOVING BEFORE MEASURING ANYTHING ON IT.
  //
  // '.wizard-panel' carries 'animation: wizard-in 160ms ease-out', and
  // '@keyframes wizard-in' starts at 'translateY(100%)', which puts every pixel
  // of the panel BELOW the bottom of the viewport. axe resolves a background by
  // sampling points of an element's rect, and it can resolve nothing for an
  // element that is not on screen, so a run that lands inside those 160ms
  // returns no result at all for the panel's text.
  //
  // That is not a smaller number. It is 0 of 7 help paragraphs and 0 of 6
  // progress lines, in both palettes, with '0 contrast failure(s)' beside it,
  // which is precisely the vacuous pass the R6 guard was written to refuse. The
  // guard did refuse it, which is the only reason this was ever visible rather
  // than being a green gate measuring an off-screen panel.
  //
  // It is also a RACE and not a constant. Probing on 2026-09-11 caught the same
  // screen at y=844 on one run and y=595 on the next, and the walk repaints on
  // every press so the animation restarts for every screen. That is why this
  // failed on this machine and passed on the one before it.
  //
  // Waited for by asking the animations whether they have finished, not by
  // sleeping for 160ms and hoping. This project has fixed the same shape of bug
  // twice already, in 'a6d1314' and '4d26e5f': a fixed wait in front of
  // asynchronous work is a bug with a delay on it. An empty animation list
  // resolves immediately, so removing the animation later costs nothing here.
  await Promise.all(
    panel.getAnimations().map(a => a.finished.catch(() => undefined)),
  );

  // MEASURED FIRST, WITH THE PAGE EXACTLY AS A SELLER HAS IT. The axe run below
  // hides everything behind the layer, and a width compared against a hidden
  // page would be a ruler moving with the thing it measures, which is the
  // mistake 'npm run menu-file' shipped once and this file exists to refuse.
  // So T043b's numbers are taken here, before anything is touched.
  //
  // Reported with both numbers, because "it overflows" is not a diagnosis. The
  // panel as well as the page: a panel that scrolls sideways inside a page that
  // does not is still a screen somebody has to drag.
  const wide = [
    { what: 'the page', scroll: page.scrollWidth, client: page.clientWidth },
    { what: 'the wizard panel', scroll: panel.scrollWidth, client: panel.clientWidth },
  ].filter(m => m.scroll > m.client);

  // EVERYTHING BEHIND THE LAYER IS HIDDEN FOR THE AXE RUN, AND THIS IS NOT THE
  // GATE MOVING ITS OWN RULER. Read this before deleting it.
  //
  // axe decides an element's background by sampling the element stack at
  // several points of its rect, and if the stacks disagree it refuses to name a
  // colour and reports 'incomplete': "background color could not be determined
  // because it partially overlaps other elements". 'document.elementsFromPoint'
  // returns everything at a point whether or not it is painted over, so an
  // OPAQUE panel does not save it: what is behind the modal is in the stack
  // regardless. Three of the seven help paragraphs landed across the edge of
  // the add-a-section dock behind them and went unmeasured for exactly that,
  // and the other four were measured only by the luck of where they fell.
  //
  // Hiding what is behind changes nothing about the quantity being measured.
  // '.wizard-panel' is 'background: var(--panel)', fully opaque, so not one
  // pixel of the rendered colour comes from behind it, and '.wizard' is
  // 'position: fixed; inset: 0', so nothing below it contributes to the panel's
  // layout either. What changes is only whether the instrument can resolve the
  // pair it is being asked about. The alternative was to accept 'incomplete' as
  // measured, which is the vacuous pass this whole phase exists to refuse.
  const hidden = [];
  for (let node = layer; node && node !== document.body; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || !(sibling instanceof HTMLElement)) continue;
      hidden.push([sibling, sibling.style.display]);
      sibling.style.display = 'none';
    }
  }

  // 'passes' and 'incomplete' are asked for as well as 'violations', and they
  // are the whole reason this screen function is not three lines long.
  //
  // A violation list cannot answer the question this walk has to answer: did
  // axe LOOK at the text. An element axe declined to evaluate produces no
  // violation, which is indistinguishable from one it evaluated and liked. That
  // is the R6 failure one layer in from where it was last caught, so the run is
  // asked what it reached rather than only what it disliked. Without the extra
  // resultTypes axe returns only the FIRST node of each of those arrays, which
  // would make the coverage count below silently wrong rather than absent.
  const r = await axe.run(document.body, {
    runOnly: { type: 'rule', values: ['color-contrast'] },
    resultTypes: ['violations', 'passes', 'incomplete'],
  });

  for (const put of hidden) put[0].style.display = put[1];

  // Which elements axe actually reached, and how it left each one.
  //
  // A result node names its element with a unique CSS selector rather than
  // holding a reference, so this resolves them back. 'target' is an array to
  // allow for frames: this gate runs one document, so the first entry is the
  // whole address, and a nested array would mean the page grew an iframe, which
  // is worth skipping rather than guessing at.
  const reached = new Map();
  for (const group of [['passes', r.passes], ['incomplete', r.incomplete], ['violations', r.violations]]) {
    for (const v of group[1]) {
      for (const n of v.nodes) {
        if (typeof n.target[0] !== 'string') continue;
        const found = document.querySelector(n.target[0]);
        if (!found) continue;
        reached.set(found, {
          how: group[0],
          why: (n.any || []).concat(n.all || []).map(c => c.message).filter(Boolean).join(' | '),
        });
      }
    }
  }

  // The muted-on-panel text, one entry per paragraph, saying whether axe got a
  // colour pair out of it. '.wizard-help' and '.wizard-progress' are
  // var(--muted) on var(--panel), the pairing that exists nowhere else on that
  // background and the entire reason this walk was written. Both 'passes' and
  // 'violations' count as measured, because both mean axe resolved the pair and
  // formed an opinion. 'incomplete' and a miss do not: those are text nobody
  // has checked, reported by a gate that would otherwise say it had.
  const muted = [...panel.querySelectorAll('.wizard-help, .wizard-progress')].map(e => {
    const seen = reached.get(e);
    return {
      what: e.className,
      how: seen ? seen.how : 'not evaluated',
      why: seen ? seen.why : 'axe returned no result for this element at all',
      text: (e.textContent || '').trim().slice(0, 60),
    };
  });
  const measured = m => m.how === 'passes' || m.how === 'violations';

  return JSON.stringify({
    helpMeasured: muted.filter(m => m.what.indexOf('wizard-help') !== -1 && measured(m)).length,
    progressMeasured: muted.filter(m => m.what.indexOf('wizard-progress') !== -1 && measured(m)).length,
    // Carried out whole rather than counted, because "one was not measured" is
    // not a diagnosis and axe's own reason string usually is.
    unmeasured: muted.filter(m => !measured(m)),
    nodes: r.violations.flatMap(v => v.nodes.map(n => ({
      target: n.target.join(' '),
      summary: (n.failureSummary || '').split('\\n').filter(Boolean).slice(-1)[0] || '',
      html: (n.html || '').slice(0, 90),
    }))),
    choices: panel.querySelectorAll('.wizard-choices li').length,
    fields: panel.querySelectorAll('input, textarea, select').length,
    help: panel.querySelectorAll('.wizard-help').length,
    progress: panel.querySelectorAll('.wizard-progress').length,
    hints: panel.querySelectorAll('.hint').length,
    wide: wide,
  });
})()`;

/**
 * Opens the wizard, measures every screen of it, and closes it again.
 *
 * WHY IT GETS ITS OWN AXE RUN, BEFORE THE EXAMPLE IS LOADED. The wizard is a
 * modal layer over everything else, and axe reports text it believes is
 * obscured as `incomplete` rather than as a violation. This gate collects only
 * violations, so leaving the layer up over the storefront would SHRINK the main
 * measurement instead of adding to it, which is the exact shape of the two bugs
 * this file already records. So: measure it alone, shut it, then load the
 * example and run the storefront pass unchanged.
 *
 * WHY EVERY SCREEN. However many questions there are, plus a finish, and they do
 * not draw the same
 * things: only the first has nine choices, only four of them have a text field,
 * and `.wizard-help` and `.wizard-progress` are `var(--muted)` on
 * `var(--panel)`, a pairing that exists nowhere else on that background. A pass
 * that opened the first screen and stopped would leave most of a new surface
 * unmeasured in both palettes.
 */
async function auditWizard() {
  console.log(`  Waiting for wizard to open...`);
  // The trigger lives on the empty state and nowhere else, which is why the
  // caller clears storage first. If this is missing, the app is not empty.
  await waitFor(
    `!!document.querySelector('[aria-controls="wizard-panel"]')`,
    "the empty state to offer the wizard",
  );
  await evaluate(`(() => {
    const t = document.querySelector('[aria-controls="wizard-panel"]');
    if (t) t.click();
  })()`);
  await waitFor(`!!document.querySelector('#wizard-panel')`, "the wizard to open");

  // Asked once, on screen one, before anything is pressed. A zero here means
  // the progress line did not say what it always says, and walking on would be
  // guessing at how far to go.
  const questions = Number(await evaluate(QUESTION_TOTAL));
  if (!Number.isInteger(questions) || questions < 1) {
    throw new Error(
      `the wizard's progress line did not name a question total, so this run cannot know how many screens it owes. Read '${String(questions)}'.`,
    );
  }
  const screens = questions + 1;

  // `help` and `progress` count what the DOM drew; `helpMeasured` and
  // `progressMeasured` count what axe got a colour out of. Both are kept
  // because they fail differently: the first catches a screen that stopped
  // drawing its help, the second catches one that draws it where axe cannot
  // read it. Either one alone would have a blind spot the other covers.
  const seen = {
    screens: 0,
    choices: 0,
    fields: 0,
    help: 0,
    progress: 0,
    hints: 0,
    helpMeasured: 0,
    progressMeasured: 0,
  };
  const nodes = [];
  const wide = [];
  const unmeasured = [];

  for (let screen = 1; screen <= screens; screen++) {
    console.log(`  Measuring screen ${screen}...`);
    const measured = JSON.parse(await evaluate(WIZARD_SCREEN));
    seen.screens++;
    for (const part of ["choices", "fields", "help", "progress", "hints", "helpMeasured", "progressMeasured"]) {
      seen[part] += measured[part];
    }
    nodes.push(...measured.nodes.map((n) => ({ ...n, screen })));
    wide.push(...measured.wide.map((m) => ({ ...m, screen })));
    unmeasured.push(...measured.unmeasured.map((m) => ({ ...m, screen })));

    if (screen === screens) break;

    console.log(`  Clicking next for screen ${screen + 1}...`);
    // Next is a real control on every question screen and is the only way
    // forward that does not also take the answer back: Skip forgets what was
    // answered, which would be a different walk from the one somebody doing
    // this for real takes.
    await evaluate(`(() => {
      const b = [...document.querySelectorAll('#wizard-panel button')]
        .find(x => (x.textContent || '').trim() === 'Next');
      if (b) b.click();
    })()`);
    // Waited for by what the next screen SAYS, not by a sleep. The progress
    // line names its own number, so this cannot be satisfied by the screen that
    // was already there, and the finish screen has no progress line at all.
    const next = screen + 1;
    await waitFor(
      next <= questions
        ? `/Question ${next} of/.test(document.querySelector('#wizard-panel .wizard-progress')?.textContent || '')`
        : `[...document.querySelectorAll('#wizard-panel button')].some(x => /Make my page/.test(x.textContent || ''))`,
      `the wizard to reach screen ${next} of ${screens}`,
    );
  }

  console.log(`  Closing wizard...`);
  // Closed, not finished. Finishing would build a page and leave the app in a
  // state the storefront pass would then have to undo.
  await evaluate(`(() => {
    const b = document.querySelector('#wizard-panel [aria-label="Close setup"]');
    if (b) b.click();
  })()`);
  await waitFor(`!document.querySelector('#wizard-panel')`, "the wizard to close");

  return { ...seen, questions, owed: screens, nodes, wide, unmeasured };
}

async function auditScheme(scheme) {
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: scheme }],
  });
  // Both schemes start cold, or the second one never sees the empty state.
  //
  // The two runs share one Chrome profile, so the dark run used to reopen an
  // app that already held the example page in IndexedDB. The wizard's only way
  // in is a trigger on the empty state, so the dark palette's wizard would have
  // gone unmeasured while the run reported a pass: the vacuity this file
  // exists to refuse. `loadRealContent` is tolerant of either state on purpose
  // and is unaffected.
  //
  // about:blank first, because clearing IndexedDB out from under a page that
  // holds an open connection to it is a delete the browser is entitled to defer
  // until that connection closes. Navigating away closes it, so the clear
  // happens against nothing and cannot be half done.
  await send("Page.navigate", { url: "about:blank" });
  await send("Storage.clearDataForOrigin", { origin: ORIGIN, storageTypes: "all" });
  await send("Page.navigate", { url: `${ORIGIN}/` });
  await sleep(2500);

  await injectAxe();
  const wizard = await auditWizard();

  await loadRealContent();

  await injectAxe();
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
      //
      // '#surface .blocks > li' rather than '#surface li': the starting point
      // picker (feature 021) is a folded 'ul' of its own, eight 'li' deep,
      // present in the empty state whether or not it is open. Counting every
      // 'li' under the surface made this number true regardless of whether the
      // example page loaded, which is exactly the vacuity this guard exists to
      // catch. Only the real page sections, the list the example actually
      // fills in, count here.
      sections: document.querySelectorAll('#surface .blocks > li').length,
      fields: document.querySelectorAll('#surface input, #surface textarea, #surface select').length,
      hints: document.querySelectorAll('#surface .hint').length,
      // Feature 025 moved the page list into a panel of its own, and this gate
      // silently went from measuring 164 elements to 137 without saying so.
      // Counted and demanded, so a panel that stops being drawn stops the run
      // rather than shrinking it.
      pages: document.querySelectorAll('.pages-panel .pages li').length,
      // Counted for the same reason, and demanded below. A fold that stops
      // opening takes about a dozen labels, hints and controls out of the
      // measurement without failing anything.
      folded: document.querySelectorAll('#surface details[open] .field').length,
    });
  })()`);
  return { ...JSON.parse(result), wizard };
}

let failed = 0;
try {
  await connect();
  await send("Page.enable");
  await send("Runtime.enable");

  // THE VIEWPORT IS SET HERE, NOT BY `--window-size`, AND IT IS THEN CHECKED.
  //
  // This gate asked Chrome for a 390 by 844 window and never once looked at
  // what it got. On Chrome 152 it got 500 by 749: neither `--headless=new` nor
  // `--headless` produces a headless browser any more, so the window carries a
  // tab strip and an address bar, and `--window-size` sizes the window rather
  // than the content. All four combinations were measured on 2026-09-11 and
  // only a device metrics override gives the page the size this gate claims to
  // be testing at.
  //
  // The consequence was not a smaller number, which is what makes it worth
  // this comment. The whole wizard panel starts at y=749 in a 749 tall
  // viewport, so every one of its help and progress paragraphs sat outside the
  // viewport, axe could resolve a background for none of them, and the walk
  // reported "0 of 7 read by axe" in both palettes. The R6 guard from Phase 6
  // of feature 027 caught it and refused the pass, which is the only reason
  // this was ever visible.
  //
  // `scripts/menu-file.mjs` already had both halves of this, and its comment
  // records why: a gate whose ruler moves with the thing it measures reports a
  // pass about nothing. Its `mobile: false` is copied here for the same reason
  // it gives, so that a page wider than the screen overflows rather than
  // widening the layout viewport to fit itself.
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const got = await evaluate(`innerWidth + 'x' + innerHeight`);
  if (got !== "390x844") {
    console.error(
      `  the viewport is ${got} and this gate only means anything at 390x844. Everything it measures, including "0 overflow(s) at 390px", would be measured somewhere else.`,
    );
    failed++;
  }

  for (const scheme of ["light", "dark"]) {
    const { violations, checked, sections, fields, hints, pages, folded, wizard } =
      await auditScheme(scheme);
    const nodes = violations.flatMap((v) => v.nodes);

    // The wizard first, because it was measured first, and on its own line so a
    // future session can see at a glance what the walk actually drew.
    console.log(
      `\n${scheme} wizard: ${wizard.screens} screens, ${wizard.choices} choices, ${wizard.fields} fields, ${wizard.help} help lines (${wizard.helpMeasured} read by axe), ${wizard.progress} progress lines (${wizard.progressMeasured} read by axe), ${wizard.hints} hints, ${wizard.nodes.length} contrast failure(s), ${wizard.wide.length} overflow(s) at 390px`,
    );

    // Seven screens, and the parts that only some of them draw. The first
    // question alone offers nine choices, four questions carry a text field,
    // and every question carries one help paragraph and one progress line. A
    // walk that stopped early, or a screen that stopped drawing its help,
    // measures less without failing anything, and this is what says so.
    if (
      wizard.screens < wizard.owed ||
      wizard.choices < 9 ||
      wizard.fields < 4 ||
      wizard.help < wizard.questions ||
      wizard.progress < wizard.questions
    ) {
      console.error(
        `  ${scheme} wizard: only ${wizard.screens} screens, ${wizard.choices} choices, ${wizard.fields} fields, ${wizard.help} help lines and ${wizard.progress} progress lines measured, against ${wizard.owed}, 9, 4, ${wizard.questions} and ${wizard.questions} expected. Something did not render, so this run proves less than it claims.`,
      );
      failed++;
    }

    // Drawn is not measured, and this is the half that has never been demanded
    // anywhere in this file.
    //
    // Every screen carries one help paragraph and every question carries one
    // progress line, both var(--muted) on var(--panel), which is the pairing
    // this whole phase exists to check. A count of the ELEMENTS is satisfied by
    // a paragraph axe skipped, and axe skipping it is not hypothetical: it
    // reports text it cannot resolve a background for as `incomplete`, which
    // this gate would otherwise discard in silence. So the coverage is demanded
    // by name, and a shortfall names the paragraph and quotes axe's own reason.
    if (wizard.helpMeasured < wizard.owed || wizard.progressMeasured < wizard.questions) {
      console.error(
        `  ${scheme} wizard: axe read a colour out of only ${wizard.helpMeasured} of ${wizard.owed} help paragraphs and ${wizard.progressMeasured} of ${wizard.questions} progress lines. The rest were drawn and never checked, so this run proves less than it claims.`,
      );
      for (const m of wizard.unmeasured) {
        console.error(`    screen ${m.screen}, ${m.what}: ${m.how}. ${m.why}`);
        console.error(`      "${m.text}"`);
      }
      failed++;
    }
    for (const n of wizard.nodes) {
      failed++;
      console.log(`  wizard screen ${n.screen}: ${n.target}`);
      console.log(`    ${n.summary}`);
      console.log(`    ${n.html}`);
    }
    // Counted as a failure the same way a contrast violation is. FR-132 is one
    // requirement in two halves, and this is the half a browser can settle: the
    // window is 390 wide because that is the phone this is built for.
    for (const m of wizard.wide) {
      failed++;
      console.error(
        `  ${scheme} wizard screen ${m.screen}: ${m.what} is ${m.scroll}px wide inside ${m.client}px, so it scrolls sideways at 390px.`,
      );
    }

    console.log(
      `\n${scheme}: ${checked} elements, ${sections} sections, ${fields} fields, ${folded} folded fields, ${hints} hints, ${pages} pages listed, ${nodes.length} contrast failure(s)`,
    );

    // A run that measured the empty shell would pass and prove nothing, which
    // is the trap three tests fell into earlier in this project. The example
    // storefront has several sections and an opened one has several fields, so
    // this refuses to report a pass it did not earn.
    if (sections < 3 || fields < 3 || pages < 1 || folded < 5) {
      console.error(
        `  ${scheme}: only ${sections} sections, ${fields} fields, ${folded} folded fields and ${pages} listed pages on screen. Something did not render, so this run proves less than it claims.`,
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
  // "Problem", not "element below the ratio". `failed` counts the coverage
  // refusals too, and a run stopped for measuring too little was reporting
  // itself as a contrast violation: two failures at a ratio nobody could find,
  // because there were none. The reason to look is printed above either way.
  console.error(`\nContrast gate FAILED: ${failed} problem(s). See the lines above for which.`);
  process.exit(1);
}
console.log("\nContrast gate clean. Light and dark both pass WCAG AA.");
