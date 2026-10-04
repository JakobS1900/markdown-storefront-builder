// Real raster decoding, device-field selection, persistence and menu-file output.
// A temporary browser profile keeps this check away from the seller's pages.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "vite";

const port = 8813;
const debugPort = 9493;
const origin = `http://127.0.0.1:${port}`;
const profileRoot = resolve(tmpdir());
const profile = mkdtempSync(join(profileRoot, "mdsb-local-pictures-"));
const server = await createServer({ logLevel: "error", server: { host: "127.0.0.1", port, strictPort: true },
  plugins: [{ name: "local-picture-check", configureServer(vite) {
    vite.middlewares.use("/__local-pictures", (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/styles.css"></head><body><div id="live-region"></div><main id="check"></main></body></html>');
    });
  } }],
});
await server.listen();
const chrome = spawn(process.env.CHROME_PATH ?? (process.platform === "win32"
  ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "google-chrome"), [
  "--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank",
], { stdio: "ignore", windowsHide: true });
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let socket;
let sequence = 0;
const pending = new Map();
const exceptions = [];
let launchError;
chrome.on("error", (error) => { launchError = error; });
function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((done, fail) => {
    const timer = setTimeout(() => { pending.delete(id); fail(new Error(`${method} exceeded 30 seconds`)); }, 30000);
    pending.set(id, (message) => { clearTimeout(timer); message.error ? fail(new Error(message.error.message)) : done(message.result); });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result?.value;
}
async function navigate() {
  await send("Page.navigate", { url: `${origin}/__local-pictures` });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate('location.pathname === "/__local-pictures" && document.readyState === "complete"')) return;
    await sleep(100);
  }
  throw new Error("Local-picture test page did not load within 10 seconds");
}
try {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (launchError) throw launchError;
    if (chrome.exitCode !== null) throw new Error("Chrome exited before startup");
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      const page = tabs.find((tab) => tab.type === "page");
      if (page) {
        socket = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((done, fail) => { socket.onopen = done; socket.onerror = fail; });
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
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate();
  const added = await evaluate(`(async () => {
    const { imageField } = await import('/src/ui/image-field.ts');
    const { heldAsset } = await import('/src/assets.ts');
    const { writePage, listAssets } = await import('/src/db.ts');
    const { emptyDocument, serializeDocument } = await import('/@fs/${resolve("engine/src/index.ts").replaceAll("\\", "/") }');
    const root = document.querySelector('#check');
    const canvas = document.createElement('canvas');
    canvas.width = 8; canvas.height = 8;
    canvas.getContext('2d').fillRect(0, 0, 4, 4);
    const png = await new Promise((done) => canvas.toBlob(done, 'image/png'));
    const ids = [];
    for (const type of ['image/png', '', 'application/octet-stream']) {
      let chosen;
      const field = imageField({ label: 'Artwork', value: '', onInput() {}, onLocal(id) { chosen = id; } });
      root.replaceChildren(field);
      const picker = field.querySelector('input[id$="-device-file"]');
      const transfer = new DataTransfer();
      transfer.items.add(new File([png], 'artwork.png', { type }));
      picker.files = transfer.files;
      picker.dispatchEvent(new Event('change'));
      const deadline = performance.now() + 10000;
      while (!chosen && !field.querySelector('.img-status.broken') && performance.now() < deadline)
        await new Promise((done) => setTimeout(done, 25));
      if (!chosen) throw new Error('Picture failed for MIME ' + JSON.stringify(type) + ': ' + field.textContent);
      ids.push(chosen);
      root.replaceChildren(imageField({ label: 'Artwork', value: '', localValue: chosen, onInput() {}, onLocal() {} }));
      const thumb = root.querySelector('.device-picture img');
      await thumb.decode();
      if (thumb.naturalWidth !== 8 || !heldAsset(chosen).startsWith('data:image/png;')) throw new Error('Missing decoded PNG thumbnail');
      const pixels = document.createElement('canvas'); pixels.width = 8; pixels.height = 8;
      pixels.getContext('2d').drawImage(thumb, 0, 0);
      if (pixels.getContext('2d').getImageData(7, 7, 1, 1).data[3] !== 0) throw new Error('Transparent pixels were lost');
    }
    const doc = { ...emptyDocument('rentry'), blocks: [{ id: 'art', kind: 'menu', heading: 'Artwork',
      tiers: ids.map((id, i) => ({ id: 'item' + i, name: 'Print ' + i, price: '$20', localImageIds: [id] })) }] };
    await writePage({ id: 'picture-check', title: 'Picture check', json: serializeDocument(doc), updatedAt: 1 });
    return { selected: ids.length, stored: (await listAssets()).length, transparent: true };
  })()`);
  await navigate();
  const reopened = await evaluate(`(async () => {
    const store = await import('/src/store.ts');
    const { heldAsset } = await import('/src/assets.ts');
    const { previewSurface } = await import('/src/ui/preview.ts');
    const { buildMenuFile } = await import('/src/menu-file.ts');
    store.init(true); await store.openPage('picture-check');
    const root = document.querySelector('#check'); previewSurface(root);
    const details = root.querySelector('#menu-file-preview');
    if (!details?.open) throw new Error('Device-picture preview is hidden');
    const images = [...details.querySelectorAll('img')];
    if (images.length !== 3) throw new Error('Reloaded picture count differs');
    await Promise.all(images.map((image) => image.decode()));
    if (images.some((image) => image.naturalWidth !== 8)) throw new Error('Reloaded picture failed decoding');
    const file = buildMenuFile(store.getState().doc, heldAsset);
    const frame = document.createElement('iframe'); frame.style.width = '100%';
    const loaded = new Promise((done) => { frame.onload = done; }); frame.srcdoc = file.html; root.append(frame); await loaded;
    const exported = [...frame.contentDocument.querySelectorAll('img')];
    await Promise.all(exported.map((image) => image.decode()));
    if (exported.length !== 3 || exported.some((image) => image.naturalWidth !== 8 || !image.src.startsWith('data:image/png;')))
      throw new Error('Exported pictures did not decode independently');
    frame.remove();
    return { reopened: images.length, previewOpen: details.open, exported: exported.length, width: innerWidth, scrollWidth: document.documentElement.scrollWidth };
  })()`);
  await send("Emulation.setDeviceMetricsOverride", { width: 320, height: 844, deviceScaleFactor: 1, mobile: true });
  const narrow = await evaluate('({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth })');
  if (added.selected !== 3 || reopened.reopened !== 3 || exceptions.length ||
    reopened.scrollWidth > reopened.width || narrow.scrollWidth > narrow.width)
    throw new Error(`Incomplete evidence: ${JSON.stringify({ added, reopened, narrow, exceptions })}`);
  console.log(JSON.stringify({ localPictures: "passed", ...added, ...reopened, narrow, browserExceptions: exceptions.length }));
} finally {
  socket?.close();
  chrome.kill();
  await server.close();
  if (resolve(profile).startsWith(join(profileRoot, "mdsb-local-pictures-"))) {
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may briefly retain the temporary profile. */ }
  }
}
