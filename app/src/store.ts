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
   * The section most recently removed, and where it was.
   *
   * Removal used to ask first. A confirmation is the wrong tool for something
   * reversible, because people automate their answer to it: it gets clicked
   * through unread, so it taxes every deliberate removal and fails to stop the
   * accidental one. The accident it was built for was really about spacing, and
   * that was fixed by spacing the controls apart.
   *
   * The index is kept as well as the block, because putting a section back at
   * the end of the page is not putting it back. Feature 014, FR-024a.
   */
  readonly undo?: { readonly block: Block; readonly index: number };
  /**
   * The saved page whose removal is waiting on an answer.
   *
   * Separate from `pendingDeleteId`, which is about a section. They are two
   * questions of very different weight and nothing good comes of one variable
   * meaning "something, somewhere, is about to be destroyed".
   */
  readonly pendingPageDeleteId?: string;
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

  // Nothing repaints while a field has focus. This is the only place that can
  // enforce it, which is why the guard lives here rather than at each caller.
  //
  // Deferring the repaint that a keystroke causes was only ever half of it.
  // Every other path into `set` repaints at once, and one of them fires during
  // exactly the wrong moment: the first save of a new page re-reads the page
  // list, which is a `set`, which rebuilt the interface under the field being
  // typed into. `replaceChildren` destroys the focused input and Android tears
  // down the InputConnection bound to it, so a character committed in that
  // window has nowhere to land. Reported on a Pixel as single letters going
  // missing at random, and as whole swiped words coming out wrong: a gesture
  // commits nothing until it ends, so the repaint lands mid-word and writes the
  // document back over a word the document has never been told about.
  //
  // Deferred rather than dropped. The moment focus leaves, everything that was
  // waiting paints at once.
  if (typing()) {
    repaintSoon();
    return;
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
  //
  // The undo offer goes too. It is not on a timer, on purpose, but leaving the
  // screen is the artist doing something else, and an offer that outlives the
  // work that replaced it is how an undo puts a section back into a page that
  // has changed underneath it.
  set({ surface, pendingPageDeleteId: undefined, undo: undefined });
}

export function selectBlock(selectedBlockId: string | undefined): void {
  set(selectedBlockId === undefined ? { selectedBlockId: undefined } : { selectedBlockId });
}

/** Asks before removing a saved page. Nothing is removed until `removePage`. */
export function askPageDelete(id: string): void {
  set({ pendingPageDeleteId: id });
}

export function cancelPageDelete(): void {
  set({ pendingPageDeleteId: undefined });
}

/**
 * Removes a saved page, never the one on screen.
 *
 * The refusal is here rather than only in the markup. Not drawing a control is
 * a decision about a screen; this is the guarantee, and it holds for anything
 * that reaches this function by any route.
 *
 * Deleting whatever is open would raise a question with no good answer. Opening
 * the next page swaps the artist's work for a different document without being
 * asked. Opening nothing leaves an empty editor that looks exactly like the
 * thing this project exists to never do. So the way to remove a page is to open
 * a different one first, and the last remaining page cannot be removed at all,
 * which is correct: nothing here should end with the artist having nothing.
 */
export async function removePage(id: string): Promise<void> {
  if (id === state.pageId) {
    cancelPageDelete();
    return;
  }

  try {
    await deletePage(id);
  } catch (error) {
    set({
      status: {
        kind: "error",
        message: `That page could not be removed: ${error instanceof Error ? error.message : String(error)}. Nothing has been changed.`,
      },
    });
    return;
  }

  cancelPageDelete();
  await refreshPages();
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
  // No DOM at all means nobody is typing. This used to be consulted only from
  // `update`, which cannot run without a document, and moving it into `repaint`
  // put it on a path the store takes with no browser present, where it threw.
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
}

export function update(doc: Document): void {
  // Anything the artist does next takes the undo offer away. Typing counts:
  // somebody who removed a section and started writing has moved on, and an
  // offer that outlives the work replacing it restores a section into a page
  // that is no longer the one it left. `removeBlock` sets its own offer after
  // calling through here, which is why this does not need to know the
  // difference.
  //
  // Cleared by deleting the key rather than assigning undefined, the same way
  // `set` does it. `exactOptionalPropertyTypes` is on, so absent and undefined
  // are different types here, and spreading one over the other is the mistake
  // the compiler is there to catch.
  if (state.undo !== undefined) {
    const withoutUndo: Record<string, unknown> = { ...state };
    delete withoutUndo["undo"];
    state = withoutUndo as unknown as State;
  }

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

/**
 * Removes a section and remembers how to put it back.
 *
 * The offer is set after the removal, not before, because `replaceBlocks` funnels
 * through `update`, which clears any offer that was already standing. That
 * ordering is what makes "the next unrelated action clears it" work without a
 * separate flag saying which action was this one.
 */
export function removeBlock(id: string): void {
  const index = state.doc.blocks.findIndex((b) => b.id === id);
  const block = state.doc.blocks[index];
  if (block === undefined) return;

  replaceBlocks(state.doc.blocks.filter((b) => b.id !== id));
  set({ undo: { block, index } });
  if (state.selectedBlockId === id) selectBlock(undefined);
}

/** Puts the last removed section back where it was. */
export function undoRemove(): void {
  const undo = state.undo;
  if (undo === undefined) return;

  const blocks = [...state.doc.blocks];
  // Clamped, because everything that could have changed the length also clears
  // the offer, so this cannot be out of range. Clamping anyway costs nothing
  // and means a future caller cannot make it throw.
  blocks.splice(Math.min(undo.index, blocks.length), 0, undo.block);
  replaceBlocks(blocks);
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

    // A page that has just come into existence has to appear in the list, and
    // this is the only moment that can be noticed: nothing else runs between a
    // new page's first save and the artist looking for it. The condition is
    // what keeps it cheap. It is false from the second keystroke onwards, so
    // this reads every stored page once per page rather than once per
    // character, which is the cost the deferred repaint exists to avoid.
    if (!state.pages.some((page) => page.id === state.pageId)) await refreshPages();

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

  set({ pageId: stored.id, doc: result.document, status: { kind: "idle" }, selectedBlockId: undefined, undo: undefined });
}

/**
 * Makes an already stored page the one on screen.
 *
 * Used when a backup has been read and written under its own id. It does not
 * save, because the caller has already done that, and saving again here would
 * mean a page could be written before anyone had checked it parses.
 */
export function adopt(pageId: string, doc: Document): void {
  set({ pageId, doc, status: { kind: "idle" }, selectedBlockId: undefined, undo: undefined });
}

/**
 * Starts an empty page and opens it.
 *
 * Saved at once rather than when it is first typed into, so a page somebody has
 * made exists and is listed. A page that appeared only after a keystroke would
 * look like the button had not worked.
 */
export async function newPage(target: string): Promise<void> {
  set({
    pageId: newId(),
    doc: emptyDocument(target),
    status: { kind: "idle" },
    selectedBlockId: undefined,
    pendingPageDeleteId: undefined,
    undo: undefined,
  });
  await save();
  await refreshPages();
}

export { deletePage, listPages, type StoredPage };
