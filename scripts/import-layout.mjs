// Real correction fields: responsive bounds, labels, keyboard order and edits.
// A temporary browser profile keeps this check away from the seller's pages.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "vite";

const port = 8814;
const origin = `http://127.0.0.1:${port}`;
const profileRoot = resolve(tmpdir());
const profile = mkdtempSync(join(profileRoot, "mdsb-import-layout-"));
const server = await createServer({ logLevel: "error", server: { host: "127.0.0.1", port, strictPort: true },
  plugins: [{ name: "import-layout-check", configureServer(vite) {
    vite.middlewares.use("/__import-layout", (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/styles.css"></head><body><div id="live-region"></div><div id="app"></div></body></html>');
    });
  } }],
});
let chrome;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let socket;
let sequence = 0;
const pending = new Map();
const exceptions = [];
let launchError;
function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((done, fail) => {
    const timer = setTimeout(() => { pending.delete(id); fail(new Error(`${method} exceeded 30 seconds`)); }, 30000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      if (message.error) fail(new Error(message.error.message));
      else done(message.result);
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result?.value;
}
async function navigate() {
  await send("Page.navigate", { url: `${origin}/__import-layout` });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate('location.pathname === "/__import-layout" && document.readyState === "complete"')) return;
    await sleep(100);
  }
  throw new Error("Import-layout test page did not load within 10 seconds");
}
async function check() {
  await server.listen();
  chrome = spawn(process.env.CHROME_PATH ?? (process.platform === "win32"
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "google-chrome"), [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank",
  ], { stdio: "ignore", windowsHide: true });
  chrome.on("error", (error) => { launchError = error; });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (launchError) throw launchError;
    if (chrome.exitCode !== null) throw new Error("Chrome exited before startup");
    try {
      const debugPort = Number(readFileSync(join(profile, "DevToolsActivePort"), "utf8").split(/\r?\n/)[0]);
      if (!Number.isInteger(debugPort) || debugPort < 1 || debugPort > 65535) throw new Error("Invalid browser debug port");
      const tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`, { signal: globalThis.AbortSignal.timeout(1000) })).json();
      const page = tabs.find((tab) => tab.type === "page");
      if (page) {
        socket = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((done, fail) => {
          const timer = setTimeout(() => fail(new Error('Browser socket did not open')), 5000);
          socket.onopen = () => { clearTimeout(timer); done(); };
          socket.onerror = (error) => { clearTimeout(timer); fail(error); };
        });
        socket.onmessage = ({ data }) => {
          const message = JSON.parse(data);
          if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text);
          if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
        };
        break;
      }
    } catch { /* Wait for this isolated Chrome process to expose its page. */ }
    await sleep(250);
  }
  if (!socket) throw new Error("Chrome did not start within 30 seconds");
  await send("Runtime.enable");
  const fixture = `| ${'VeryLongName'.repeat(12)} | Amount | Price | Notes |\n| --- | --- | --- | --- |\n| Hand painted ceramic mug with a long fictional name | 12 oz | $25 | Glazed blue with a hand painted leaf pattern and careful gift wrapping |\n| Bowl | 16 oz | | |`;
  await send("Emulation.setDeviceMetricsOverride", { width: 800, height: 1000, deviceScaleFactor: 1, mobile: true });
  await navigate();
  await evaluate(`(async () => {
    const store = await import('/src/store.ts');
    const { renderShell } = await import('/src/ui/shell.ts');
    const root = document.querySelector('#app');
    store.init(true);
    store.subscribe(() => renderShell(root));
    renderShell(root);
    window.clickButton = (label) => {
      const button = [...document.querySelectorAll('button')].find((node) => node.textContent === label);
      if (!button) throw new Error('Missing button: ' + label);
      button.click();
    };
    clickButton('Paste a page you already have');
    const box = document.querySelector('.page-paste textarea');
    box.focus(); box.value = ${JSON.stringify(fixture)};
    box.dispatchEvent(new Event('input', { bubbles: true })); box.blur();
    clickButton('Review these columns as Prices');
    clickButton('Adjust imported prices');
  })()`);
  const measurements = [];
  const failures = [];
  for (const width of [800, 390, 320]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: true });
    const measured = await evaluate(`(() => {
      const cards = [...document.querySelectorAll('.page-paste-card')];
      const bounds = (node) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
      const visible = (node) => node && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, cards: cards.map((card) => ({
        height: bounds(card).height,
        fields: [...card.querySelectorAll('input[type=text]')].map((input) => ({ label: input.labels?.[0]?.textContent, value: input.value, ...bounds(input) })),
        source: card.querySelector('.page-paste-row-source')?.textContent,
        destination: card.querySelector('.page-paste-destination')?.textContent,
        result: card.querySelector('.page-paste-row-result')?.textContent,
        issue: card.querySelector('.page-paste-row-issue')?.textContent,
        contextVisible: [...card.querySelectorAll('label, .page-paste-row-source, .page-paste-destination, .page-paste-row-result, .page-paste-row-issue')]
          .filter((node) => node.textContent && !node.closest('[hidden]')).every(visible),
        controls: [...card.querySelectorAll('.checkbox, button')].filter((node) => !node.hidden).map(bounds),
        keep: [...card.querySelectorAll('button')].some((node) => node.textContent === 'Keep without a price, source row 4'),
        keepInFields: [...card.querySelectorAll('.page-paste-fields button')].length
      })) };
    })()`);
    measurements.push(measured);
    if (measured.scrollWidth > width) failures.push(`${width}: horizontal page overflow`);
    if (measured.cards.length !== 2) throw new Error('Expected two actual correction cards');
    for (const [index, card] of measured.cards.entries()) {
      const labels = card.fields.map((field) => field.label);
      const expected = ['Item', 'Price', 'Amount', 'Details'].map((name) => `${name}, source row ${index + 3}`);
      if (JSON.stringify(labels) !== JSON.stringify(expected)) failures.push(`${width}: DOM field order ${labels.join(', ')}`);
      const field = (name) => card.fields.find((input) => input.label === `${name}, source row ${index + 3}`);
      const [item, price, amount, details] = ['Item', 'Price', 'Amount', 'Details'].map(field);
      if (!item || !price || !amount || !details) throw new Error('Missing explicitly labelled field');
      if (width === 800) {
        if (Math.abs(item.y - price.y) > 1 || Math.abs(amount.y - details.y) > 1 || price.x < item.x + item.width || details.x < amount.x + amount.width || amount.y < item.y + item.height)
          failures.push('800: expected Item | Price above Amount | Details');
      } else if (!(price.y >= item.y + item.height && amount.y >= price.y + price.height && details.y >= amount.y + amount.height)) {
        failures.push(`${width}: fields must stack in reading order`);
      }
      if ([...card.fields, ...card.controls].some((r) => r.width < 44 || r.height < 44 || r.x < 0 || r.x + r.width > width))
        failures.push(`${width}: correction targets must fit and be at least 44px`);
      if (!card.source || !card.destination?.startsWith('Destination:') || !card.result?.startsWith('Proposed:')) failures.push('Missing row context');
      if (!card.contextVisible) failures.push('Hidden correction label or context');
      if (card.keepInFields) failures.push('Keep without a price interrupted field grid');
    }
    if (!measured.cards[0].fields.find((f) => f.label.startsWith('Details')).value.includes('gift wrapping')) failures.push('Lost nonempty details');
    if (!measured.cards[1].keep || !measured.cards[1].issue) failures.push('Missing blank-price action/warning');
  }
  console.log(JSON.stringify({ importLayoutMeasurements: measurements.map(({ width, scrollWidth, cards }) => ({
    width, scrollWidth, cards: cards.map(({ height, fields }) => ({ height, fields }))
  })) }));
  if (failures.length) throw new Error(failures.join('\n'));

  // Real key events must follow visual order and keep edits in the live store.
  for (const width of [800, 390, 320]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: true });
    await evaluate("document.querySelector('.page-paste-card input[type=text]').focus()");
    for (const [name, value] of [['Item', 'Edited mug'], ['Price', '$31'], ['Amount', '20 oz'], ['Details', 'Edited wrapping']]) {
      const label = `${name}, source row 3`;
      if (await evaluate('document.activeElement.labels?.[0]?.textContent') !== label) throw new Error(`${width}: incorrect keyboard order at ${label}`);
      await evaluate('document.activeElement.select(); window.editingInput = document.activeElement');
      await send('Input.insertText', { text: value });
      const edit = await evaluate(`(async () => {
        const store = await import('/src/store.ts');
        const row = store.getPagePasteReview().rows[0];
        return { focused: document.activeElement === window.editingInput, value: document.activeElement.value,
          stored: row[${JSON.stringify(name === 'Item' ? 'name' : name.toLowerCase())}] };
      })()`);
      if (!edit.focused || edit.value !== value || edit.stored !== value) throw new Error(`${width}: lost focus or edit in ${label}`);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    }
  }
  const actions = await evaluate(`(async () => {
    clickButton('Keep without a price, source row 4');
    if (document.activeElement.labels?.[0]?.textContent !== 'Price, source row 4') throw new Error('Blank-price action lost row focus');
    const store = await import('/src/store.ts');
    if (store.getState().pastingPage.corrections['0:4:0'].price !== '') throw new Error('Blank-price choice not retained');
    const include = [...document.querySelectorAll('.page-paste-card input[type=checkbox]')].find((input) => input.labels?.[0]?.textContent === 'Include source row 4');
    include.click();
    const card = document.querySelector('.page-paste-card[data-row-key="0:4:0"]');
    if (!card.querySelector('.page-paste-row-result').textContent.includes('Excluded.') || card.querySelectorAll('input[type=text]').length !== 4)
      throw new Error('Excluded row lost editable fields or outcome');
    return { blankPrice: true, excludedRow: true };
  })()`);
  if (exceptions.length) throw new Error(`Browser exceptions: ${exceptions.join(', ')}`);
  console.log(JSON.stringify({ importLayout: 'passed', keyboardWidths: [800, 390, 320], ...actions }));
}
let deadline;
try {
  await Promise.race([check(), new Promise((_done, fail) => {
    deadline = setTimeout(() => fail(new Error('Import layout check exceeded 90 seconds')), 90000);
  })]);
} finally {
  clearTimeout(deadline);
  socket?.close();
  chrome?.kill();
  await server.close();
  if (resolve(profile).startsWith(join(profileRoot, "mdsb-import-layout-"))) {
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may briefly retain the temporary profile. */ }
  }
}
