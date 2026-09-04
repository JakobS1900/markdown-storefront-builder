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
import type { Rounding } from "./money.js";
import { canBeProduct, readCandidates, toProducts } from "./price-list-text.js";

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
  /**
   * The one thing that can be put back, and how.
   *
   * A removed SECTION goes back at the index it came from. A removed ROW goes
   * back by restoring the section as it was the moment before, which is one
   * mechanism for price list items, gallery images and profile links rather
   * than three.
   *
   * Removing a section was undoable and removing a row was not, which is
   * backwards: a shop has three sections and thirty products, and a product
   * holds far more typing than a section does.
   *
   * A bulk price application shares the ROW mechanism rather than adding a
   * fourth: pricing forty rows at once is, from undo's point of view, exactly
   * "the section changed and here is what it looked like before", the same
   * fact a single row edit represents. Only the wording at the call site
   * needs to know it was forty rows and not one.
   */
  readonly undo?:
    | { readonly kind: "block"; readonly block: Block; readonly index: number }
    | { readonly kind: "row"; readonly block: Block; readonly label: string }
    | {
        readonly kind: "bulk";
        readonly block: Block;
        readonly label: string;
        /**
         * What was done to the section, so the offer can say it.
         *
         * Absent means "priced", which is what this variant meant when feature
         * 022 was the only thing setting it. Feature 023 writes a whole
         * section at once too, and "Undo pricing 25 items" is the wrong
         * sentence for a conversion that priced nothing. A fourth undo kind
         * was not added, because the comment above already argues that both
         * are the same fact: the section changed, and here is what it was.
         */
        readonly action?: "priced" | "added";
      };
  /**
   * The saved page whose removal is waiting on an answer.
   *
   * Separate from `pendingDeleteId`, which is about a section. They are two
   * questions of very different weight and nothing good comes of one variable
   * meaning "something, somewhere, is about to be destroyed".
   */
  readonly pendingPageDeleteId?: string;
  /**
   * Which price list rows are chosen for bulk pricing, held by tier `id`
   * within exactly one menu block.
   *
   * FR-055a: never by position, so it survives a reorder. Scoped to one block
   * because tier ids are unique only within their own block, not across the
   * document. `engine/src/document/migrate.ts` restarts numbering at `t0` for
   * every menu section it migrates, so two different price lists can each
   * legitimately hold a tier called `t0`. A flat, document-wide list of ids
   * could not tell those apart: ticking the first row of one price list also
   * ticked the first row of every other price list sharing that id. Recording
   * which block the selection belongs to makes that state impossible to
   * represent, rather than filtering it out after the fact at every place
   * that reads it.
   *
   * Selecting a row in a different block replaces the selection rather than
   * merging into it, which matches what a seller looking at one price list
   * expects the count on screen to mean: the list in front of them, not a
   * total across every list on the page.
   *
   * It is also never chased through removal: a row that is deleted just stops
   * matching an id still sitting in `tierIds`, which is why `update()` does
   * not touch this field on any ordinary edit. Reading the selection against
   * a live set of tier ids, rather than trying to catch every path that can
   * shrink a section, is what makes that correct.
   */
  readonly selectedTiers?: { readonly blockId: string; readonly tierIds: readonly string[] };
  /**
   * What the three "Apply pricing" inputs currently hold, as typed text plus
   * the chosen rounding.
   *
   * Held here rather than only in the DOM for the same reason `selectedBlockId`
   * and `pendingPageDeleteId` are: the shell rebuilds the whole tree on most
   * state changes (see `repaint`), which would otherwise reset these three
   * controls to their defaults the moment anything else on screen changed,
   * such as ticking another row's checkbox.
   */
  readonly bulkPricingInputs?: { readonly multiplier: string; readonly extra: string; readonly rounding: Rounding };
  /**
   * A price list the seller has pasted but not yet converted, and which of its
   * lines are ticked.
   *
   * Deliberately NOT held as draft rows in the document, which was the cheaper
   * design and would have reused feature 022's row selection for free. A draft
   * row is not a draft: it is a real product, so it saves to IndexedDB, it
   * compiles, and it publishes. A seller pasting sixty lines to keep twenty
   * five would have had thirty five lines they never agreed to on their live
   * page, which inverts the one rule this feature exists to uphold.
   *
   * Ticks are held by line index, and that is not the mistake `selectedTiers`
   * exists to avoid. A tier id is needed there because the document underneath
   * a selection can be reordered or shortened while the selection stands, and
   * an index would then name a different row. This text is not immutable, and
   * an earlier version of this comment wrongly said it was. What is true is
   * narrower and is the part that carries the argument: the only thing that
   * can change the text is `setPasteText`, and it recomputes the ticks against
   * the new text in the same breath. The two are never written apart, so an
   * index can never be left over from a list it no longer describes.
   *
   * `blockId` names the price list the seller opened this from, which is where
   * the converted rows go. It is also why there is no "which list" question to
   * answer: they answered it by pressing the button where they pressed it.
   *
   * Cleared wherever `selectedTiers` is cleared, and for the same reason
   * `openPage` gives there: starters and reopened backups keep the block ids
   * from their file, so two pages made from one starting point share a menu
   * block id. A paste left standing across a page switch would reappear under
   * a price list in a document the seller never pasted anything into, and Add
   * would write it there.
   */
  readonly pasting?: {
    readonly blockId: string;
    readonly text: string;
    readonly ticked: readonly number[];
  };
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
  //
  // The selection joins the same list, and for the same reason: it is a
  // question left standing over one screen, and leaving the screen is the
  // artist's answer to it too.
  set({
    surface,
    pendingPageDeleteId: undefined,
    undo: undefined,
    selectedTiers: undefined,
    bulkPricingInputs: undefined,
    pasting: undefined,
  });
}

/**
 * Ticks or unticks one row for bulk pricing, by id, within one price list.
 *
 * FR-055a. Held by `id` rather than position so a reorder cannot silently
 * point this at the wrong row. Scoped to `blockId` because tier ids repeat
 * across menu blocks, see `State.selectedTiers`. Ticking a row in a block
 * other than the one currently selected starts a fresh selection for the new
 * block rather than adding to the old one, since a stray id shared with
 * another price list must never be read as "also chosen here".
 */
export function toggleTier(blockId: string, id: string): void {
  const current = state.selectedTiers;
  const tierIds = current !== undefined && current.blockId === blockId ? current.tierIds : [];
  const next = tierIds.includes(id) ? tierIds.filter((existing) => existing !== id) : [...tierIds, id];
  set({ selectedTiers: { blockId, tierIds: next } });
}

/**
 * Replaces the whole selection with one price list's, for "select all" and
 * "select none" alike. Whatever was selected in a different block is
 * replaced, not merged with, for the same reason `toggleTier` starts fresh:
 * one selection, naming one price list, is the shape that cannot mean two
 * things at once.
 */
export function selectTiers(blockId: string, ids: readonly string[]): void {
  set({ selectedTiers: { blockId, tierIds: [...ids] } });
}

/** Clears the selection entirely, regardless of which block it belonged to. */
export function clearTierSelection(): void {
  set({ selectedTiers: undefined });
}

/**
 * The tier ids actually selected within one menu block, live.
 *
 * Every reader of `selectedTiers` has to make two checks, not one: that the
 * selection names this block at all (tier ids repeat across menu blocks, see
 * the field comment above), and that each id still names a row that exists
 * (a selected row that is removed just stops matching, on purpose, see
 * `update()`'s comment). A review round was already spent fixing a version of
 * this that skipped the first check: on the app's own `public/example.json`,
 * three menu blocks all migrate to a tier `t0`, so an unscoped read of
 * `tierIds` ticked one row and lit up three. One accessor doing both checks,
 * used everywhere the selection is read, is what keeps a third reader from
 * bringing that back.
 */
export function selectedIdsIn(block: Extract<Block, { kind: "menu" }>): readonly string[] {
  const selection = state.selectedTiers;
  if (selection === undefined || selection.blockId !== block.id) return [];
  const live = new Set(block.tiers.map((tier) => tier.id));
  return selection.tierIds.filter((id) => live.has(id));
}

/** Replaces what the three "Apply pricing" inputs hold. */
export function setBulkPricingInputs(next: { multiplier: string; extra: string; rounding: Rounding }): void {
  set({ bulkPricingInputs: next });
}

/**
 * Opens the paste screen against one price list, which is where its rows land.
 *
 * Reopening the same list keeps whatever is already there, rather than wiping
 * it. Nothing is discarded until the seller says so is the rule this feature
 * exists to uphold, and "you pressed the button twice" is not them saying so.
 */
export function startPasting(blockId: string): void {
  if (state.pasting?.blockId === blockId) return;
  set({ pasting: { blockId, text: "", ticked: [] } });
}

/**
 * Replaces the pasted text, and re-reads which lines look like items.
 *
 * The ticks are recomputed rather than carried over, because they are indices
 * into the old text and the new text is a different list. Keeping them would
 * be the "held by position" bug that `selectedTiers` exists to avoid, arriving
 * by the one route this screen is actually exposed to.
 *
 * Note what this does NOT call: `update()`. That writes the document and
 * clears the standing undo offer, and a paste changes no document. Routing
 * this through it would have thrown away the seller's undo for a keystroke in
 * a text box.
 */
export function setPasteText(text: string): void {
  const current = state.pasting;
  if (current === undefined) return;

  const ticked = readCandidates(text).flatMap((candidate, i) => (candidate.suggested ? [i] : []));
  set({ pasting: { blockId: current.blockId, text, ticked } });
}

/** Ticks or unticks one pasted line. */
export function togglePasteLine(index: number): void {
  const current = state.pasting;
  if (current === undefined) return;

  const ticked = current.ticked.includes(index)
    ? current.ticked.filter((i) => i !== index)
    // Sorted, so the ticks stay in paste order however the seller clicked
    // them, and so `toProducts` does not have to care.
    : [...current.ticked, index].sort((a, b) => a - b);

  set({ pasting: { ...current, ticked } });
}

/**
 * Ticks every line that could be a product.
 *
 * Not every line: a blank line and a Markdown table's rule have no reading
 * that is somebody's product, and ticking them would turn "select all" into a
 * way to create empty rows.
 */
export function tickAllPasteLines(): void {
  const current = state.pasting;
  if (current === undefined) return;

  const ticked = readCandidates(current.text).flatMap((candidate, i) => (canBeProduct(candidate) ? [i] : []));
  set({ pasting: { ...current, ticked } });
}

export function untickAllPasteLines(): void {
  const current = state.pasting;
  if (current === undefined) return;
  set({ pasting: { ...current, ticked: [] } });
}

/** Puts the paste screen away and forgets the text. */
export function stopPasting(): void {
  set({ pasting: undefined });
}

/**
 * Whether this section is a price list nobody has typed into yet.
 *
 * `blankBlock` gives every new menu section one empty tier, so a seller who
 * adds a price list in order to paste into it has one placeholder sitting
 * there. Appending after it would leave a blank first product in every list
 * built that way, which is the common path into this feature rather than an
 * edge case.
 */
function isBlankPlaceholder(tiers: Extract<Block, { kind: "menu" }>["tiers"]): boolean {
  const only = tiers.length === 1 ? tiers[0] : undefined;
  return only !== undefined && only.name === "" && only.price === "";
}

/**
 * Turns the ticked lines into products in the price list they were pasted
 * into, as one write and one undo.
 *
 * Converting twice appends twice, on purpose. This does not remember which
 * lines it has already converted, because the seller may well mean it: a
 * second pass over the lines they did not tick the first time is a real thing
 * to want. Only the most recent conversion is undoable, which is not a choice
 * made here but what `State.undo` is: one slot, cleared by the next write.
 */
export function convertPaste(): void {
  const current = state.pasting;
  if (current === undefined) return;

  const block = state.doc.blocks.find((b) => b.id === current.blockId);
  if (block === undefined || block.kind !== "menu") return;

  const products = toProducts(readCandidates(current.text), current.ticked);
  // Nothing ticked, or nothing ticked that could be a product. FR-066: this
  // does nothing rather than writing an empty section.
  if (products.length === 0) return;

  const existing = isBlankPlaceholder(block.tiers) ? [] : block.tiers;
  const tiers = [...existing, ...products.map((product) => ({ id: newId(), ...product }))];
  const label = `${String(products.length)} item${products.length === 1 ? "" : "s"}`;

  applyWholesale(block.id, { ...block, tiers }, label, "added");
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
 * Whether the focused control is one a repaint could take a character or a
 * gesture away from.
 *
 * A repaint rebuilds the DOM, so the focused element becomes a different
 * node. Android binds its keyboard to the focused editable through an
 * InputConnection; replacing that element tears the connection down and
 * builds a new one, and a character committed during the gap has nowhere to
 * land.
 *
 * Measured on a Moto G7, typing "Full colour bust" into a Prices section: with
 * the element replaced mid-word, three runs in eight lost a character, always
 * the one straight after the swap. With it left alone, none of eight did. A
 * bare page that never replaces its input lost nothing in six runs, which is
 * what rules out the injection and leaves the app.
 *
 * That reasoning is about text entry, so it covers a text-like input and a
 * textarea, and nothing else. A checkbox, a radio, a plain button, or a file
 * input has no InputConnection and nothing mid-commit to lose: browsers focus
 * a checkbox on click, so treating it as "typing" deferred every repaint for
 * as long as it held focus and made ticking a row look like it had done
 * nothing until something else took focus away.
 */
const NON_TEXT_INPUT_TYPES = new Set(["checkbox", "radio", "button", "file"]);

function typing(): boolean {
  // No DOM at all means nobody is typing. This used to be consulted only from
  // `update`, which cannot run without a document, and moving it into `repaint`
  // put it on a path the store takes with no browser present, where it threw.
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement) return true;
  return active instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(active.type);
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
  set({ undo: { kind: "block", block, index } });
  if (state.selectedBlockId === id) selectBlock(undefined);
}

/**
 * Removes one row from a section and remembers the section as it was.
 *
 * The caller has already worked out what the section looks like without the
 * row, because only the caller knows whether it is holding items, images or
 * links. What this adds is the offer to put it back.
 *
 * Set after the change for the same reason `removeBlock` does it: every write
 * funnels through `update`, which clears any offer already standing, so the
 * ordering is what makes "the next unrelated action clears it" work.
 */
export function removeRow(id: string, next: Block, label: string): void {
  const previous = state.doc.blocks.find((b) => b.id === id);
  if (previous === undefined) return;

  replaceBlocks(state.doc.blocks.map((b) => (b.id === id ? next : b)));
  set({ undo: { kind: "row", block: previous, label } });
}

/**
 * Writes every row of one price list at once, and remembers the whole section
 * as it was so the entire application can be put back in one action.
 *
 * One `replaceBlocks` call, not one per row. `update()` fires a full document
 * write on every call, so pricing forty rows one at a time would be forty
 * writes and forty "Saved" flickers for what a seller experiences as a single
 * button press.
 *
 * The undo entry is set after the write, the same order `removeRow` uses and
 * for the same reason: `replaceBlocks` funnels through `update()`, which
 * clears whatever offer was already standing, so setting this one first would
 * only have it cleared a moment later by the write it is describing.
 *
 * The selection is left untouched, so a seller can look at the result, adjust
 * the multiplier, and apply again.
 */
export function applyBulkPricing(blockId: string, next: Block, label: string): void {
  applyWholesale(blockId, next, label, "priced");
}

/**
 * The mechanism underneath `applyBulkPricing` and `convertPaste` alike.
 *
 * Both replace a whole section in one write and remember the section as it
 * was, which is one fact, not two. `action` exists only so the offer can name
 * what happened: "Undo pricing 25 items" is the wrong sentence for a
 * conversion that priced nothing.
 */
function applyWholesale(blockId: string, next: Block, label: string, action: "priced" | "added"): void {
  const previous = state.doc.blocks.find((b) => b.id === blockId);
  if (previous === undefined) return;

  replaceBlocks(state.doc.blocks.map((b) => (b.id === blockId ? next : b)));
  set({ undo: { kind: "bulk", block: previous, label, action } });
}

/** Puts back whatever was last removed or applied: a section, a row, or a bulk price change. */
export function undoLast(): void {
  const undo = state.undo;
  if (undo === undefined) return;

  if (undo.kind === "row" || undo.kind === "bulk") {
    // The section is put back wholesale rather than the row (or rows) spliced
    // in, so nothing can land in the wrong place if anything else about the
    // section moved. Nothing else can have moved, because that would have
    // cleared the offer, and restoring the whole thing means that stays true
    // for free.
    replaceBlocks(state.doc.blocks.map((b) => (b.id === undo.block.id ? undo.block : b)));
    return;
  }

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

  // The selection and the pricing panel's inputs go too, for the same reason
  // `setSurface` already clears them: `State.selectedTiers`' own comment calls
  // the selection a question left standing over one screen, and replacing the
  // whole document out from under it is at least as strong a reason as
  // leaving the screen. Starters and reopened backups keep the block and tier
  // ids from their file, so a page made from the same template as the one on
  // screen can share a `blockId` and tier ids such as `t0`, and a stale
  // selection would go on matching rows in a document the seller never
  // ticked anything in.
  set({
    pageId: stored.id,
    doc: result.document,
    status: { kind: "idle" },
    selectedBlockId: undefined,
    undo: undefined,
    selectedTiers: undefined,
    bulkPricingInputs: undefined,
    pasting: undefined,
  });
}

/**
 * Makes an already stored page the one on screen.
 *
 * Used when a backup has been read and written under its own id. It does not
 * save, because the caller has already done that, and saving again here would
 * mean a page could be written before anyone had checked it parses.
 */
export function adopt(pageId: string, doc: Document): void {
  // The selection and the pricing inputs go too. See `openPage`'s comment:
  // block and tier ids survive a reopen, so a stale selection can go on
  // matching rows in a document the seller never touched.
  set({
    pageId,
    doc,
    status: { kind: "idle" },
    selectedBlockId: undefined,
    undo: undefined,
    selectedTiers: undefined,
    bulkPricingInputs: undefined,
    pasting: undefined,
  });
}

/**
 * Starts an empty page and opens it.
 *
 * Saved at once rather than when it is first typed into, so a page somebody has
 * made exists and is listed. A page that appeared only after a keystroke would
 * look like the button had not worked.
 */
export async function newPage(target: string): Promise<void> {
  // The selection and the pricing inputs go too, for the reason `openPage`'s
  // comment gives: a fresh document starts from a starter template whose
  // block and tier ids can match the ones a stale selection was still naming.
  set({
    pageId: newId(),
    doc: emptyDocument(target),
    status: { kind: "idle" },
    selectedBlockId: undefined,
    pendingPageDeleteId: undefined,
    undo: undefined,
    selectedTiers: undefined,
    bulkPricingInputs: undefined,
    pasting: undefined,
  });
  await save();
  await refreshPages();
}

export { deletePage, listPages, type StoredPage };
