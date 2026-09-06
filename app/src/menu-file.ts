/**
 * The saved menu file.
 *
 * `specs/024-menu-file/contracts/menu-file.md` is the authority on what this
 * produces. The short version: one file, self contained, inert, readable, and
 * an OUTPUT rather than an interchange format. Nothing reopens it.
 *
 * It is built from `compile(doc, MENU_FILE)` through the same renderer the
 * preview uses, which is what makes Principle VII hold for the file and not
 * only for the screen. A second emitter that produced markup directly would be
 * a second thing to keep in step, and the first time the two disagreed the
 * seller would be looking at a preview of a file that does not exist.
 *
 * ON MARKUP, and the direction it is allowed to travel.
 *
 * Nothing here parses a string into DOM. `renderMarkdown` builds every node
 * with `createElement` and sets every piece of text with `textContent`, and the
 * shell below is built the same way, including its `<title>`. Serializing that
 * tree back out with `outerHTML` is the safe direction: it reads markup out of
 * a tree, it never turns a string into one. There is no `innerHTML` here and
 * there must never be one.
 */
import { MENU_FILE, compile } from "@mdsb/engine";
import type { Document } from "@mdsb/engine";

import { renderMarkdown } from "./ui/render-markdown.js";

/** What the file is called when it is handed to the device. */
export const MENU_FILE_NAME = "menu.html";

/** Turns a picture held on this device into image data. `undefined` means gone. */
export interface AssetResolver {
  (id: string): string | undefined;
}

/**
 * A resolver that has nothing to offer, which is every caller until the asset
 * store exists (Phase 4, T036). A picture it refuses is removed from the file
 * and reported by name, which is FR-088's behaviour arriving early rather than
 * a placeholder.
 */
export const NO_ASSETS: AssetResolver = () => undefined;

/**
 * Web pictures already read, keyed by the address exactly as it appears in the
 * compiled output.
 *
 * A key present with `undefined` means the read was attempted and refused,
 * which is what the seller is told about under FR-076. A key that is absent
 * means nobody tried, and nothing is said.
 */
export type PictureBytes = ReadonlyMap<string, string | undefined>;

export interface MenuFile {
  readonly html: string;
  /** Written for the seller. Empty means the file is complete. */
  readonly notes: string[];
}

/** How long to wait on one picture before giving up on it. */
const PICTURE_TIMEOUT_MS = 8000;

/**
 * Undoes `encodeAddress`, and only `encodeAddress`.
 *
 * `decodeURIComponent` is the obvious wrong answer here, and the contract says
 * so in its own section. The engine percent-encodes exactly `( ) < > " ' backtick
 * backslash` and whitespace, and nothing else, so it is not a subset of
 * `encodeURIComponent` and is not inverted by it:
 *
 * - a literal `%` in an identifier passes through the encoder untouched, so
 *   `mdsb-asset:a%41b` would come back as the identifier `aAb` and silently
 *   resolve to a different picture;
 * - `mdsb-asset:100%` would make `decodeURIComponent` throw `URIError`, taking
 *   out the whole export rather than one image.
 *
 * So this reverses the specific set the encoder produces and leaves every other
 * percent alone. A sequence it does not recognise is not a sequence the encoder
 * wrote.
 *
 * Known limit, stated rather than discovered: the encoder writes the full code
 * point, so an exotic space such as U+2028 becomes `%2028`, which this reads as
 * `%20` followed by "28". The result is an identifier no store holds, so the
 * picture is removed and the seller is told, which is the safe direction. It
 * cannot resolve to a different picture. No identifier the app mints contains
 * one; only a hand edited backup could.
 */
function decodeAddress(address: string): string {
  return address.replace(/%([0-9A-Fa-f]{2})/g, (whole, hex: string) => {
    const ch = String.fromCharCode(Number.parseInt(hex, 16));
    return /[()\s<>"'`\\]/.test(ch) ? ch : whole;
  });
}

/**
 * The alt text of a compiled image, as a pattern.
 *
 * `[^\]]*` was the obvious version and the hostile corpus broke it in one run.
 *
 * The cause was misdiagnosed at the time, and the wrong diagnosis is recorded
 * here because it is the more useful half. It was reported as the engine
 * escaping an opening bracket in alt text and not a closing one. **The engine
 * escapes both.** `ESCAPABLE` in `engine/src/compile/escape.ts` covers `[` and
 * `]`, and an item named `[click](x)` compiles to `![\[click\](x)](address)`.
 * There is no engine defect of that shape. Do not go looking for one.
 *
 * The real reason is duller: an escaped bracket is a backslash followed by a
 * literal `]`, so a pattern that excludes `]` stops inside the escape sequence
 * rather than at the end of the alt text.
 *
 * So the alt is anything up to the closing bracket that is followed by the
 * address, with two limits that keep it from eating the page: it cannot cross a
 * line, and it cannot contain the start of another image. Without the second, a
 * lazy match would begin at the FIRST image on a line and swallow everything up
 * to the asset image at the end of it.
 */
const ALT = String.raw`(?:(?!!\[)[^\n])*?`;

/**
 * The text of a compiled label, as the seller wrote it.
 *
 * Alt text arrives escaped for the host, so `Bob\'s` and `&#36;45` would reach
 * the seller as plumbing. Running it back through the renderer and reading the
 * text off undoes exactly what the compiler did, using the code that already
 * knows how, rather than a second copy of the escape table here.
 */
function asWritten(compiled: string): string {
  return renderMarkdown(compiled).textContent ?? "";
}

/** Names an image in a note, falling back when it has no alt text of its own. */
function pictureName(alt: string): string {
  const name = asWritten(alt).trim();
  return name === "" ? "One of your pictures" : name;
}

/**
 * Removes every picture held on this device that the resolver cannot supply.
 *
 * This runs on the compiled Markdown, before it becomes elements, because by
 * the time it is elements the address is gone: `safeAddress` refuses a scheme
 * it does not know and the renderer degrades a refused address to the seller's
 * literal words, so `mdsb-asset:a1-oranges` would appear as visible text in the
 * middle of the price list. The contract calls a file containing that anywhere
 * a defect.
 *
 * Removed, not left as text and not left as a broken image. FR-088: the file is
 * still produced and the item is named.
 *
 * CHUNK 3: an address the resolver DOES supply is deliberately left alone here.
 * Phase 4 lets `safeAddress` through for this one scheme (T047) so it becomes a
 * real `img`, and then sets the bytes on that node (T046). Doing it that way
 * keeps the bytes out of both address checks, which is research D3's whole
 * reason for the identifier form. Until T047 lands, every caller passes
 * `NO_ASSETS`, so nothing takes that branch.
 */
function resolveLocalPictures(body: HTMLElement, resolve: AssetResolver, notes: string[]): void {
  const SCHEME = "mdsb-asset:";

  for (const img of [...body.querySelectorAll("img")]) {
    // `getAttribute`, not `.src`. The property resolves against the document's
    // base address and would hand back something else entirely.
    const src = img.getAttribute("src") ?? "";
    if (!src.startsWith(SCHEME)) continue;

    const bytes = resolve(decodeAddress(src.slice(SCHEME.length)));
    if (bytes !== undefined) {
      img.src = bytes;
      continue;
    }

    // `img.alt` is already the seller's own words: the renderer unescapes alt
    // text on the way in, so nothing here has to undo the compiler a second
    // time.
    const named = img.alt.trim() === "" ? "One of your pictures" : img.alt.trim();
    notes.push(`${named}: your own picture is not in this file, because it is not stored on this device.`);
    img.remove();
  }
}

/** Every web picture the compiled output actually shows, still encoded. */
function pictureAddresses(doc: Document): string[] {
  const found = new Set<string>();
  for (const match of compile(doc, MENU_FILE).markdown.matchAll(
    new RegExp(String.raw`!\[${ALT}\]\((https?:[^)\s]*)\)`, "g"),
  )) {
    const address = match[1];
    if (address !== undefined) found.add(address);
  }
  return [...found];
}

/**
 * Bytes as base64.
 *
 * `FileReader` would do this in one call and was the first attempt. It reads
 * nothing under jsdom, because the blob a fetch produces there comes from a
 * different realm than the reader, so the embedding test failed with the
 * picture still a web address and no error anywhere. Going through the bytes
 * has no realm to be wrong about.
 *
 * In chunks because `fromCharCode` is applied to the whole array at once and a
 * photograph is a few hundred thousand bytes, which is enough arguments to
 * overflow the call stack.
 */
function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let at = 0; at < bytes.length; at += 8192) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
  }
  return btoa(binary);
}

/** Reads one web picture as image data, or gives up on it. */
async function readPicture(address: string): Promise<string | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PICTURE_TIMEOUT_MS);
  try {
    const response = await fetch(address, { signal: controller.signal });
    if (!response.ok) return undefined;
    const blob = await response.blob();
    // An allow list, for the same reason every other check in this project is
    // one: the file is opened by other people in contexts we do not control.
    // SVG is excluded even though a browser will not run script in one loaded
    // through `img`, because the type is a document format and the rest are
    // not, and Phase 4 refuses to store one for the same reason.
    if (!blob.type.startsWith("image/") || blob.type === "image/svg+xml") return undefined;
    return `data:${blob.type};base64,${base64(new Uint8Array(await blob.arrayBuffer()))}`;
  } catch {
    // A refusal, a timeout, a dead host, or a site that will not be read across
    // origins. FR-076: the file is still produced and the picture stays a web
    // address, so it still works for a reader who has a connection.
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads the page's web pictures so they can be embedded. Best effort, always.
 *
 * Separate from building the file so that building stays synchronous and
 * cannot be made to depend on the network. A caller that skips this gets a file
 * whose web pictures are still web addresses, which is a worse file rather than
 * a broken one.
 */
export async function fetchPictures(doc: Document): Promise<PictureBytes> {
  const read = new Map<string, string | undefined>();
  for (const address of pictureAddresses(doc)) {
    read.set(address, await readPicture(address));
  }
  return read;
}

/** Puts the picture data on the nodes, and names what could not be put there. */
function embedPictures(body: HTMLElement, pictures: PictureBytes, notes: string[]): void {
  for (const img of body.querySelectorAll("img")) {
    const address = img.getAttribute("src") ?? "";
    if (!pictures.has(address)) continue;
    const data = pictures.get(address);
    if (data === undefined) {
      notes.push(
        `${pictureName(img.getAttribute("alt") ?? "")}: that website would not let us copy the picture into the file, so it only shows with a connection.`,
      );
      continue;
    }
    img.src = data;
  }
}

/**
 * The body of the menu file, and what the seller has to be told about it.
 *
 * Exported so the preview can draw the same nodes the file will contain. Two
 * renders of the same input from the same code, which is the only honest way to
 * promise that what is on screen is what gets saved.
 */
export function menuFileBody(
  doc: Document,
  resolve: AssetResolver,
  pictures: PictureBytes = new Map(),
): { body: HTMLElement; notes: string[] } {
  const notes: string[] = [];

  const body = document.createElement("div");
  body.className = "rendered";
  body.append(renderMarkdown(compile(doc, MENU_FILE).markdown));
  resolveLocalPictures(body, resolve, notes);
  embedPictures(body, pictures, notes);

  return { body, notes };
}

/**
 * The whole file.
 *
 * The shell is a real document built with the DOM, not a template string with
 * values dropped into it. That matters for exactly one value: the title is the
 * seller's, and a template would need this file to escape it correctly. Setting
 * it as text and reading the markup back out means there is nothing here to get
 * wrong, which is the same argument the renderer makes for its own nodes.
 */
export function buildMenuFile(
  doc: Document,
  resolve: AssetResolver,
  pictures: PictureBytes = new Map(),
): MenuFile {
  const { body, notes } = menuFileBody(doc, resolve, pictures);

  const shell = document.implementation.createHTMLDocument(
    doc.title === undefined || doc.title.trim() === "" ? "Menu" : doc.title,
  );

  const charset = shell.createElement("meta");
  charset.setAttribute("charset", "utf-8");
  const viewport = shell.createElement("meta");
  viewport.setAttribute("name", "viewport");
  viewport.setAttribute("content", "width=device-width, initial-scale=1");
  // Ahead of the title, because a browser looks for the encoding in the first
  // bytes of the file and a long title could push it out of reach.
  shell.head.prepend(charset, viewport);

  const style = shell.createElement("style");
  style.textContent = STYLES;
  shell.head.append(style);

  // A document with no language is one a screen reader has to guess the
  // pronunciation of, and axe fails a page without it. Stated as English
  // because that is the language the app itself is written in; nothing here
  // knows what the seller typed, and a wrong guess is still better than an
  // absent one, which forces the reader's default rather than a stated value.
  shell.documentElement.lang = "en";

  // A landmark, so somebody using a screen reader can go straight to the menu
  // instead of walking the document. It is added here and not in `menuFileBody`
  // because the app already has a `main` and a second one inside it would be
  // wrong.
  const main = shell.createElement("main");
  main.append(shell.importNode(body, true));
  shell.body.append(main);

  return { html: `<!doctype html>\n${shell.documentElement.outerHTML}\n`, notes };
}

/**
 * The part of `app/src/styles.css` a rendered page actually uses, inlined.
 *
 * Both palettes, because the file is opened by whoever the seller sends it to
 * and their phone has its own setting. No linked stylesheet, no linked font,
 * no `url()` of any kind: the contract says everything needed to display it is
 * inside the one file.
 *
 * This is a deliberate copy of `.rendered` at `app/src/styles.css:887-988`
 * rather than a build step that extracts it, and the copy is what `npm run
 * menu-file` measures: that gate opens a produced file in a real browser at 390
 * CSS pixels, fails on sideways page scroll, and runs axe over it including
 * colour contrast. Drift between the two therefore fails a gate rather than
 * shipping quietly.
 *
 * The `.table-scroll` wrapper and the `min-width` on the table are load
 * bearing and are the reason that gate exists. A floor on the cells instead of
 * the table gives every column exactly the floor; no floor at all and a price
 * table at 390px stacks one word per line down cells 590px tall.
 */
const STYLES = `
:root {
  color-scheme: light dark;
  --bg: #f3f1f7;
  --panel: #ffffff;
  --sunken: #efedf5;
  --ink: #16151b;
  --line: #e5e2ed;
  --r-sm: 9px;
  --r-md: 15px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #111016;
    --panel: #1f1e26;
    --sunken: #191821;
    --ink: #f2f0ee;
    --line: #302e3a;
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 1rem;
  background: var(--bg);
  color: var(--ink);
  font: 1rem / 1.55 system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

.rendered {
  max-width: 44rem;
  margin: 0 auto;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  padding: 1.5rem 1.4rem;
  overflow-wrap: break-word;
  line-height: 1.65;
}

.rendered > :first-child {
  margin-top: 0;
}

.rendered h1,
.rendered h2,
.rendered h3 {
  letter-spacing: -0.01em;
  line-height: 1.25;
  margin: 1.6rem 0 0.6rem;
}

.rendered img {
  max-width: 100%;
  height: auto;
  border-radius: var(--r-sm);
}

.rendered .table-scroll {
  overflow-x: auto;
  border-radius: var(--r-sm);
}

.rendered table {
  min-width: 34rem;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.rendered th,
.rendered td {
  border: 1px solid var(--line);
  padding: 0.5rem 0.7rem;
  text-align: left;
  vertical-align: top;
}

.rendered th {
  background: var(--sunken);
  font-size: 0.875rem;
  letter-spacing: 0.005em;
}

.rendered hr {
  border: 0;
  border-top: 1px solid var(--line);
  margin: 1.75rem 0;
}

.rendered a {
  color: inherit;
}
`;
