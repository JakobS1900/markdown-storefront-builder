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

import { assetIds, dataUrl, heldAsset, holdAssets } from "./assets.js";
import { renderMarkdown } from "./ui/render-markdown.js";

/** What the file is called when it is handed to the device. */
export const MENU_FILE_NAME = "menu.html";

/** Turns a picture held on this device into image data. `undefined` means gone. */
export interface AssetResolver {
  (id: string): string | undefined;
}

/**
 * A resolver that has nothing to offer.
 *
 * Not a placeholder any more: it is the honest answer for a caller with no
 * store behind it, and it is what the hostile text corpus and the contract
 * tests use so that they measure the file's shape rather than the device's
 * contents. A picture it refuses is removed from the file and reported by name,
 * which is FR-088.
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
// The alt pattern that used to live here is gone, and the history is kept
// because it is the whole argument of this file.
//
// `[^\]]*` was the obvious version and the hostile corpus broke it in one run.
// The cause was misdiagnosed as the engine failing to escape a closing bracket.
// It escapes both: `ESCAPABLE` covers `[` and `]`, and an item named
// `[click](x)` compiles to `![\[click\](x)](address)`. The real reason is
// duller. An escaped bracket is a backslash followed by a literal `]`, so a
// pattern excluding `]` stops inside the escape sequence rather than at the end
// of the label.
//
// The replacement pattern was better and still wrong, in three different ways
// over three reviews: it let a seller forge an asset token by naming a product
// `X](mdsb-asset:evil)`, and it fetched a gallery item's link address as though
// it were a picture. Every fix made it cleverer and none made it right.
//
// Nothing in this file matches structure out of text any more. Local pictures
// resolve on `img` nodes, web pictures are found on `img` nodes, and the seller's
// words can never become a node.

/**
 * Names an image in a note, falling back when it has no alt text of its own.
 *
 * Takes the alt off a NODE, which the renderer has already unescaped, so there
 * is nothing left to undo here.
 *
 * It used to run the alt back through `renderMarkdown` and read the text off,
 * on the correct reasoning that compiled alt text arrives escaped for the host
 * and `Bob\'s` would otherwise reach the seller as plumbing. That reasoning
 * stopped applying when the caller changed from passing compiled Markdown to
 * passing `img.alt`, and nobody noticed, so an item named `Oranges **fresh**`
 * lost its asterisks in one note and kept them in the other. Two paths in one
 * file naming the same picture two different ways, which the holistic review
 * found by reading them side by side.
 */
function pictureName(alt: string): string {
  const name = alt.trim();
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
 * An address the resolver DOES supply has its bytes set on the node instead.
 * `safeAddress` lets this one scheme through so the address survives into an
 * ELEMENT, and only then does the picture data go on it, so the bytes never
 * pass through either address check. That is research D3's whole reason for the
 * identifier form, and it is why a seller's own words cannot forge one: text
 * can look like the token, but text can never become a node.
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

    // The same helper the web picture note uses, so the two cannot name the
    // same picture differently again.
    notes.push(
      `${pictureName(img.alt)}: your own picture is not in this file, because it is not stored on this device.`,
    );
    img.remove();
  }
}

/**
 * Every web picture the compiled output actually shows, still encoded.
 *
 * Read off elements, not matched out of the Markdown, which is the third time
 * this feature has learned the same lesson and the first time it was learned
 * before something broke rather than after.
 *
 * The pattern version fetched the wrong thing. A gallery picture that carries a
 * link compiles to `[![alt](mdsb-asset:a1)](https://link.test/page)`, and since
 * the address group cannot match `mdsb-asset:`, the lazy label backtracked past
 * the inner image and captured the OUTER link. Saving a menu file then issued a
 * serial HTTP request, eight second timeout apiece, against whatever site the
 * seller had linked to. Nothing was embedded from it and no note was produced,
 * so it was invisible: a third party ping from a feature whose whole promise is
 * that it needs no connection.
 *
 * A link is an `a` and a picture is an `img`. The tree knows the difference and
 * a pattern over the text does not.
 */
function pictureAddresses(doc: Document): string[] {
  const probe = document.createElement("div");
  probe.append(renderMarkdown(compile(doc, MENU_FILE).markdown));

  const found = new Set<string>();
  for (const img of probe.querySelectorAll("img")) {
    const src = img.getAttribute("src") ?? "";
    if (/^https?:/i.test(src)) found.add(src);
  }
  return [...found];
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
    // The same conversion the device pictures use, from the same place, so the
    // two kinds of picture cannot end up encoded differently.
    return dataUrl(blob);
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

/**
 * Reads the page's pictures from this device so they can be embedded.
 *
 * The counterpart of `fetchPictures`, and here for the same reason: IndexedDB
 * is asynchronous and `buildMenuFile` is not. `buildMenuFile` must stay
 * synchronous, because `menuFileBody` is also what the preview draws on every
 * repaint, and a render that awaited anything would either stutter while
 * somebody types or show them a file that is one keystroke out of date.
 *
 * So the reading happens here, before the build, and the resolver handed to the
 * build is a lookup into what was read. A picture that is no longer stored is
 * simply absent from it, and `resolveLocalPictures` removes it and names the
 * item, which is FR-088.
 */
export async function fetchAssets(doc: Document): Promise<AssetResolver> {
  await holdAssets(assetIds(doc));
  return heldAsset;
}

/** Puts the picture data on the nodes, and names what could not be put there. */
function embedPictures(body: HTMLElement, pictures: PictureBytes, notes: string[]): void {
  for (const img of body.querySelectorAll("img")) {
    const address = img.getAttribute("src") ?? "";
    if (!pictures.has(address)) continue;
    const data = pictures.get(address);
    if (data === undefined) {
      notes.push(
        `${pictureName(img.alt)}: that website would not let us copy the picture into the file, so it only shows with a connection.`,
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
  const compiled = compile(doc, MENU_FILE);

  // The compiler's own diagnostics for THIS host, carried through to the seller.
  //
  // They were dropped on the floor, and the holistic review found it. The
  // emitters raise `picture_superseded` when a gallery item or an avatar carries
  // both a device picture and a web address, because the device one wins here
  // and the other has to be reported rather than vanish. Nothing read it: this
  // function took `.markdown` and discarded `.diagnostics`, and every other
  // surface compiles for the paste host, which never raises it.
  //
  // So the warning existed, was tested in the engine, and reached nobody. That
  // is worse than not having raised it, because the comment at the emit site
  // says in as many words that this seller's output is the last place a picture
  // should disappear without a word. Both halves of that promise are now here.
  for (const diagnostic of compiled.diagnostics) {
    notes.push(diagnostic.message);
  }

  const body = document.createElement("div");
  body.className = "rendered";
  body.append(renderMarkdown(compiled.markdown));
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
