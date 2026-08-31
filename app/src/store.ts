/**
 * Application state.
 *
 * One document, one target, one active surface, plus whatever the last save or
 * load had to say. Small enough to keep in one place, which is the point:
 * scattered state is how a saved page and an edited page drift apart, and
 * feature 001's holistic review already showed how expensive that is.
 */
import {
  emptyDocument,
  parseDocument,
  serializeDocument,
  type Block,
  type Document,
  type Issue,
} from "@mdsb/engine";

import { deletePage, listPages, readPage, writePage, type StoredPage } from "./db.js";

export type Surface = "build" | "preview" | "export";

export interface Status {
  readonly kind: "idle" | "saved" | "error";
  readonly message?: string;
  /**
   * Present when a page could not be loaded. FR-018: the artist must always be
   * able to get their raw content back, even when we refuse to open it.
   */
  readonly rawRecovery?: { readonly id: string; readonly json: string };
  readonly issues?: readonly Issue[];
}

export interface State {
  readonly pageId: string;
  readonly doc: Document;
  readonly surface: Surface;
  readonly selectedBlockId?: string;
  /**
   * The section whose removal is waiting on an answer.
   *
   * Removal is the one action here that destroys work and cannot be undone, and
   * its control sits between "move up" and "move down" in three touch targets
   * side by side on a phone. So it asks, and the question is state rather than
   * a native `confirm()`: the interface rebuilds its DOM on every change and a
   * modal would block that loop, quite apart from the answer belonging next to
   * the row it concerns.
   */
  readonly pendingDeleteId?: string;
  readonly status: Status;
  readonly storageOk: boolean;
  /**
   * Every page in this browser's storage, newest first.
   *
   * Held in state rather than read when the list renders, because rendering is
   * synchronous and storage is not. It is refreshed at the moments the set can
   * actually change, not on every save: a save alters one record's timestamp,
   * and re-reading every page's JSON on every keystroke to notice that would
   * cost far more than the ordering is worth. The entry for the page on screen
   * therefore reads its title from the live document instead of from here.
   */
  readonly pages: readonly StoredPage[];
}

type Listener = (state: State) => void;

/**
 * A patch may explicitly clear an optional field.
 *
 * `exactOptionalPropertyTypes` is on, which is what stops the app confusing
 * absent with undefined, exactly as the contract does. That strictness means a
 * patch that clears a field has to say so in its type rather than sneaking an
 * undefined past.
 */
type Patch = { [K in keyof State]?: State[K] | undefined };

let state: State;
const listeners = new Set<Listener>();

/**
 * A page identifier.
 *
 * Randomness lives here rather than in the engine, which is forbidden it by
 * Principle I. `crypto.randomUUID` is available in every browser this targets
 * and gives a collision-free identifier without a dependency.
 */
export function newId(): string {
  return crypto.randomUUID();
}

export function init(storageOk: boolean, doc?: Document, pageId?: string): State {
  state = {
    pageId: pageId ?? newId(),
    doc: doc ?? emptyDocument("rentry"),
    surface: "build",
    status: storageOk
      ? { kind: "idle" }
      : {
          kind: "error",
          message:
            "This browser will not let the page save anything, so your work will be lost when you close the tab. Private browsing usually causes this. Use Export to keep a copy.",
        },
    storageOk,
    pages: [],
  };
  return state;
}

/**
 * Re-reads which pages exist.
 *
 * Called when the set of pages can have changed: at launch, after opening one,
 * and after a backup has been written under a new id. Failure is swallowed on
 * purpose. Not knowing the list is a missing convenience; it must never be able
 * to take down the surface that is showing somebody their work.
 */
export async function refreshPages(): Promise<void> {
  if (!state.storageOk) return;
  try {
    set({ pages: await listPages() });
  } catch {
    // Left as it was. An empty or stale list hides the switcher at worst.
  }
}

export function getState(): State {
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Repainting is deferred while the shape of the page is holding still.
 *
 * The app rebuilds its entire interface whenever state changes, and a keystroke
 * is a state change. On a Moto G7 one rebuild measured 37ms, and a keystroke
 * caused two of them, because saving reports "Saved" and that is a state change
 * too. So every character cost roughly 75ms of blocked main thread, and
 * anything typed faster than that was dropped by the WebView outright. Typing
 * "Ari" on the device produced "Ar".
 *
 * Nothing needs repainting while someone types. The field already shows what
 * they typed; the DOM is ahead of the state, not behind it. What does need to
 * catch up is peripheral: the collapsed summary of a section, the saved
 * indicator, the preview on another tab. None of that is worth a rebuild per
 * character, and all of it can wait for the typist to pause.
 *
 * A change that alters the shape of the page is different. Adding a section or
 * an image row has to appear at once, or a button press feels ignored.
 */
const QUIET_MS = 200;
let pendingRepaint: ReturnType<typeof setTimeout> | undefined;

function repaint(): void {
  if (pendingRepaint !== undefined) {
    clearTimeout(pendingRepaint);
    pendingRepaint = undefined;
  }
  for (const listener of listeners) listener(state);
}

function repaintSoon(): void {
  if (pendingRepaint !== undefined) clearTimeout(pendingRepaint);
  pendingRepaint = setTimeout(() => {
    pendingRepaint = undefined;
    repaint();
  }, QUIET_MS);
}

/**
 * What the interface is built out of, ignoring anything a person types.
 *
 * Two documents with the same signature produce the same controls in the same
 * order, so only their contents differ and the existing DOM is still correct.
 * Ids, kinds, and row counts are included because each one changes what is on
 * screen. The target is included because it changes which warnings appear.
 */
function shapeOf(doc: Document): string {
  const blocks = doc.blocks
    .map((block) => {
      const rows =
        "items" in block && Array.isArray(block.items)
          ? block.items.length
          : "tiers" in block && Array.isArray(block.tiers)
            ? block.tiers.length
            : 0;
      return `${block.id}:${block.kind}:${String(rows)}`;
    })
    .join("|");
  return `${doc.target}#${blocks}`;
}

function set(next: Patch): void {
  // Spreading the patch would widen every field to include undefined, because
  // a patch is allowed to clear one. Copying key by key keeps State exact:
  // a key present with undefined clears that field, and a key absent leaves it.
  const merged: Record<string, unknown> = { ...state };
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) delete merged[key];
    else merged[key] = value;
  }
  state = merged as unknown as State;
  repaint();
}

/** As `set`, but lets the current paint stand until typing stops. */
function setQuietly(next: Patch): void {
  const merged: Record<string, unknown> = { ...state };
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) delete merged[key];
    else merged[key] = value;
  }
  state = merged as unknown as State;
  repaintSoon();
}

export function setSurface(surface: Surface): void {
  // An unanswered question does not follow the artist to another screen and
  // wait there. Leaving is an answer, and the safe one.
  set({ surface, pendingDeleteId: undefined });
}

export function selectBlock(selectedBlockId: string | undefined): void {
  set(selectedBlockId === undefined ? { selectedBlockId: undefined } : { selectedBlockId });
}

/** Asks before removing a section. Nothing is removed until `removeBlock`. */
export function askDelete(id: string): void {
  set({ pendingDeleteId: id });
}

export function cancelDelete(): void {
  set({ pendingDeleteId: undefined });
}

export function setTarget(target: string): void {
  update({ ...state.doc, target });
}

/**
 * Replaces the document and saves.
 *
 * Every edit funnels through here, so there is exactly one path from a change
 * to storage. That is what stops the saved copy and the edited copy diverging.
 */
/**
 * Whether a field currently has the caret in it.
 *
 * A repaint rebuilds the DOM, so the focused input becomes a different element.
 * Android binds its keyboard to the focused editable through an
 * InputConnection; replacing that element tears the connection down and builds
 * a new one, and a character committed during the gap has nowhere to land.
 *
 * Measured on a Moto G7, typing "Full colour bust" into a Prices section: with
 * the element replaced mid-word, three runs in eight lost a character, always
 * the one straight after the swap. With it left alone, none of eight did. A
 * bare page that never replaces its input lost nothing in six runs, which is
 * what rules out the injection and leaves the app.
 */
function typing(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
}

export function update(doc: Document): void {
  // Only the contents changed, so what is on screen is still the right set of
  // controls and the one being typed into is already correct. Anything that
  // adds, removes, reorders, or retargets repaints at once, unless somebody is
  // mid-word: typing the first character into a placeholder row genuinely adds
  // a row, and repainting for it would take the field away between keystrokes.
  if (shapeOf(doc) === shapeOf(state.doc) || typing()) setQuietly({ doc });
  else set({ doc });
  void save();
}

export function replaceBlocks(blocks: readonly Block[]): void {
  update({ ...state.doc, blocks });
}

export function updateBlock(id: string, next: Block): void {
  replaceBlocks(state.doc.blocks.map((b) => (b.id === id ? next : b)));
}

export function addBlock(block: Block): void {
  replaceBlocks([...state.doc.blocks, block]);
  selectBlock(block.id);
}

export function removeBlock(id: string): void {
  replaceBlocks(state.doc.blocks.filter((b) => b.id !== id));
  if (state.pendingDeleteId === id) cancelDelete();
  if (state.selectedBlockId === id) selectBlock(undefined);
}

/** Moves a block one position. Returns silently when it is already at the end. */
export function moveBlock(id: string, direction: -1 | 1): void {
  const blocks = [...state.doc.blocks];
  const from = blocks.findIndex((b) => b.id === id);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= blocks.length) return;
  const moved = blocks[from];
  const displaced = blocks[to];
  if (moved === undefined || displaced === undefined) return;
  blocks[from] = displaced;
  blocks[to] = moved;
  replaceBlocks(blocks);
}

async function save(): Promise<void> {
  if (!state.storageOk) return;

  try {
    // serializeDocument validates first and throws rather than writing a page
    // that could not be read back (guarantee G7). A throw here means a bug in
    // the editor, not a problem with the artist's page, so it is surfaced
    // rather than swallowed.
    const json = serializeDocument(state.doc);
    await writePage({
      id: state.pageId,
      json,
      title: state.doc.title === undefined || state.doc.title === "" ? "Untitled page" : state.doc.title,
      updatedAt: Date.now(),
    });
    // Quietly: this fires on every keystroke and only changes one word in the
    // status line. Repainting the whole interface to announce it was half of
    // the cost of typing a character.
    setQuietly({ status: { kind: "saved" } });
  } catch (error) {
    set({
      status: {
        kind: "error",
        message: `This page could not be saved: ${error instanceof Error ? error.message : String(error)}. Your work is still on screen. Use Export to keep a copy.`,
      },
    });
  }
}

/**
 * Opens a saved page.
 *
 * A record that does not validate is NOT deleted, NOT repaired, and NOT opened.
 * The artist is told, and handed the raw stored text so they can keep it. That
 * is FR-018, and it is the difference between refusing to open a page and
 * losing it.
 */
export async function openPage(id: string): Promise<void> {
  // Before anything else, and on every path out of here including the two
  // failures. Switching away from a page is the moment its stored title stops
  // being the one on screen, so it is the moment the list has to catch up.
  await refreshPages();

  const stored = await readPage(id);
  if (stored === undefined) {
    set({ status: { kind: "error", message: "That page is no longer in this browser's storage." } });
    return;
  }

  const result = parseDocument(stored.json);
  if (!result.ok) {
    set({
      status: {
        kind: "error",
        message:
          "This page was saved by a different version of the tool, or its contents were damaged, so it has not been opened. Nothing has been changed. You can download exactly what was saved.",
        rawRecovery: { id: stored.id, json: stored.json },
        issues: result.issues,
      },
    });
    return;
  }

  set({ pageId: stored.id, doc: result.document, status: { kind: "idle" }, selectedBlockId: undefined });
}

/**
 * Makes an already stored page the one on screen.
 *
 * Used when a backup has been read and written under its own id. It does not
 * save, because the caller has already done that, and saving again here would
 * mean a page could be written before anyone had checked it parses.
 */
export function adopt(pageId: string, doc: Document): void {
  set({ pageId, doc, status: { kind: "idle" }, selectedBlockId: undefined, pendingDeleteId: undefined });
}

export async function newPage(target: string): Promise<void> {
  set({
    pageId: newId(),
    doc: emptyDocument(target),
    status: { kind: "idle" },
    selectedBlockId: undefined,
  });
  await save();
}

export { deletePage, listPages, type StoredPage };
