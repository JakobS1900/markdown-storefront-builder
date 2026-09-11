/**
 * What somebody said, turned into a page.
 *
 * THIS FILE TOUCHES NOTHING. No DOM, no store, no IndexedDB, no dynamic
 * import, and it does not mutate what it is handed. That is not tidiness: it is
 * where every real decision in this feature lives, and holding them here means
 * they can be checked directly instead of through six screens of clicking.
 * `app/tests/wizard-answers.test.ts` runs with no jsdom at all, deliberately,
 * and if that ever stops being possible the decisions have leaked into the
 * surface.
 *
 * One direction only. Answers become a page; nothing reads a page back into
 * answers, because editing a finished page through the wizard is out of scope.
 *
 * WHAT IT IS NOT ALLOWED TO DO, and each one is a requirement rather than a
 * preference:
 *
 *   - It invents no page content. The answer to "what do you sell" chooses one
 *     of the eight starting points that already ship, and there is no ninth
 *     (FR-122). What it writes into that starting point is only what somebody
 *     typed.
 *   - It writes the store name where a BUYER will see it (FR-121). `title` is
 *     a document field the compiler never emits, and the editor labels it "Only
 *     you see this". A name written only there looks right in the editor and is
 *     invisible to everybody the page was made for, which is the worst shape a
 *     defect can have. It goes to the About you section, and to `title` as
 *     well, because that is how the page is listed when somebody comes back.
 *   - It never writes an empty string. A question somebody skipped leaves the
 *     starting point's own content exactly where it was. An absent optional
 *     field and an empty one must not be able to mean the same thing: the
 *     contract distinguishes them and every migration in this project is
 *     written around it.
 *   - It adds no field and no parallel way of saying anything. How an item
 *     reaches a buyer goes to `availability`, which feature 026 added for this
 *     (FR-124), and what the price buys goes to `unit`, which the contract has
 *     always had.
 *
 * CHUNK 2: THIS CHUNK NEVER HAD ITS TWO PER CHUNK REVIEWS. `CLAUDE.md` asks for
 * a fresh spec-compliance reviewer and a fresh code-quality reviewer after each
 * chunk. The implementer subagent died on a session rate limit on 2026-09-08
 * and no further agent could be started, so this was written and reviewed by
 * the same session, which is the one thing the rule exists to prevent. The
 * holistic review at T048 is therefore carrying two chunks' worth of scrutiny
 * here rather than one. The two judgement calls most worth a second opinion,
 * both argued at the point they are made below: dropping the example row's
 * description when somebody names their own item, and trimming what was typed.
 */
import type { Block, Document } from "@mdsb/engine";

type Menu = Extract<Block, { kind: "menu" }>;
type Tier = Menu["tiers"][number];

/**
 * The four ways an item reaches a buyer, taken from the contract rather than
 * restated here. A fifth added to the schema arrives here on its own, and a
 * copy of the list in the app is exactly the parallel definition FR-124 exists
 * to prevent.
 */
export type SellingMode = NonNullable<Tier["availability"]>;

/**
 * Everything the wizard can be told, all of it optional.
 *
 * Optional because every question is skippable (FR-120) and answering nothing
 * must still produce a usable page (FR-127). It is held in memory while the
 * wizard is open and gone the moment it closes: it is not a document, it has no
 * version, and it is never written to IndexedDB.
 *
 * `sells` is a plain string rather than a union of the eight identifiers, and
 * that is deliberate. `app/src/starters/index.ts` discovers the starting points
 * from the directory precisely so that adding one edits no list, and a union
 * here would put that list straight back. The test asserts the default is one
 * the loader actually found, which is the check a union would have bought.
 */
export interface WizardAnswers {
  /** A starting point's id, or the literal `other`. */
  readonly sells?: string;
  readonly storeName?: string;
  /** Which section is open when the page appears. Changes no page content. */
  readonly wantsPicture?: boolean;
  readonly firstItem?: string;
  readonly firstPrice?: string;
  readonly mode?: SellingMode;
  readonly amount?: string;
}

/**
 * Where "something else" lands, and where somebody who skipped the question
 * lands.
 *
 * Handmade and crafts, because it is the most general shape that ships: an
 * About you, a price list, a gallery and prose, so whatever somebody actually
 * sells they meet every part of the editor rather than a subset chosen for
 * them.
 */
export const DEFAULT_STARTER_ID = "handmade-and-crafts";

/**
 * What somebody actually said, or nothing.
 *
 * Blank and whitespace count as skipped: a person who tapped into a field,
 * thought better of it and moved on has answered nothing, and treating that as
 * an answer would write an empty name over the starting point's own.
 *
 * The value is returned trimmed. A shop is not a different shop for the spaces
 * around its name, and those spaces are invisible in every place the name is
 * later shown.
 */
function answered(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const said = value.trim();
  return said === "" ? undefined : said;
}

/** The starting point an answer chooses. FR-122. */
export function starterIdFor(answers: WizardAnswers): string {
  const sells = answered(answers.sells);
  return sells === undefined || sells === "other" ? DEFAULT_STARTER_ID : sells;
}

/**
 * The row stripped back to the OFFER, keeping the seller's new name.
 *
 * The starting point's first row describes something else: its own blurb, its
 * own photograph, its own bulk pricing. Renaming it and leaving all of that
 * hands somebody who typed "Carved oak sign" a picture of resin coasters and
 * the words "tell me your scent and colour preferences" underneath it, which
 * reads as a mistake they made.
 *
 * THE LINE USED TO BE DRAWN ONE FIELD TOO WIDE, AND IT SHIPPED A WRONG PRICE.
 * It was taken from the contract's own grouping at `availability` in
 * `descriptor.ts`, where price, unit, availability and leadTime "qualify the
 * offer rather than describing the thing". That is true of the FIELDS. It is
 * not true of a VALUE carried across a rename: `freelance-services` ships
 * `unit: "per hour"` and `art-commissions` ships `unit: "per character"`, and
 * both of those describe the product that was there before. Somebody who picked
 * Freelance services, typed "Logo design" and "300", and then took question 6's
 * own advice to leave the amount alone, published
 * `| Logo design | USD 300 per hour |` to every host. Found by feature 027's
 * holistic review at T048 and proved by compiling it.
 *
 * Six of the eight starting points ship `unit: "each"`, including
 * `handmade-and-crafts`, which is the default every test uses. So the rename
 * tests all passed while being run against the one value that happens to be
 * harmless. **A fixture whose value is the neutral one cannot discriminate.**
 *
 * So the line is now: a renamed row keeps only what is structural or what the
 * seller themselves supplied. `price` is the deliberate exception and it is
 * data model rule 3, which chose it and tests it: a leftover number is wrong in
 * a way a seller sees immediately, where "per hour" reads as something they
 * chose.
 *
 * Named rather than deleted from, so that a field added to a row later is
 * dropped by default. Getting that wrong in the other direction leaks the
 * example's content into somebody's page silently, which is this bug again.
 */
function offerOnly(tier: Tier, name: string): Tier {
  return {
    // The row's own identifier, kept: it is what anything pointing at this row
    // uses, and a new one would break a selection for nothing. Never emitted.
    id: tier.id,
    name,
    price: tier.price,
    // `unit`, `availability` and `leadTime` are deliberately NOT carried. Each
    // describes the offer that was there before the rename. Questions 5 and 6
    // put the seller's own `availability` and `unit` back in `withAnswers`
    // immediately below, so answering them still works; skipping them now
    // leaves the row saying nothing rather than saying the template's words.
  };
}

/** The first row, carrying whatever was answered about it. */
function withAnswers(tier: Tier, answers: WizardAnswers): Tier {
  const name = answered(answers.firstItem);
  const price = answered(answers.firstPrice);
  const unit = answered(answers.amount);

  return {
    ...(name === undefined ? tier : offerOnly(tier, name)),
    ...(price === undefined ? {} : { price }),
    ...(unit === undefined ? {} : { unit }),
    ...(answers.mode === undefined ? {} : { availability: answers.mode }),
  };
}

/**
 * A starting point plus somebody's answers, as a page.
 *
 * The starting point arrives already loaded, so this stays a pure function of
 * its two arguments and the caller keeps the lazy import and the busy message
 * that go with it.
 *
 * With no answers at all it returns the starting point unchanged, and the test
 * asserts that as BYTES rather than as a shape, on every host. That is the
 * property the whole feature rests on: choosing to answer nothing costs
 * nothing.
 */
export function documentFromAnswers(starter: Document, answers: WizardAnswers): Document {
  const storeName = answered(answers.storeName);

  // A row is only rewritten if something was actually said about it. Otherwise
  // the starting point's own first row is left exactly as it shipped.
  const saidAboutTheItem =
    answered(answers.firstItem) !== undefined ||
    answered(answers.firstPrice) !== undefined ||
    answered(answers.amount) !== undefined ||
    answers.mode !== undefined;

  const profileAt = starter.blocks.findIndex((block) => block.kind === "profile");
  // "Portfolio and about me" ships with no prices at all, deliberately, so
  // somebody who picks it and then names an item has the item dropped rather
  // than a Prices section invented under them. FR-122 again: this function does
  // not add sections.
  const menuAt = starter.blocks.findIndex((block) => block.kind === "menu");

  const blocks = starter.blocks.map((block, at) => {
    if (storeName !== undefined && at === profileAt && block.kind === "profile") {
      return { ...block, displayName: storeName };
    }
    if (saidAboutTheItem && at === menuAt && block.kind === "menu") {
      const first = block.tiers[0];
      // A price list with no rows has no first row to write to, and adding one
      // would be inventing content. No starting point is in this state.
      if (first === undefined) return block;
      return { ...block, tiers: [withAnswers(first, answers), ...block.tiers.slice(1)] };
    }
    return block;
  });

  // `wantsPicture` is read here and used for nothing, which is the design
  // rather than an oversight. It decides which section is already open when the
  // page appears, so somebody who said yes lands looking at the picture field
  // instead of hunting for it. That is the surface's business. Two pages
  // differing only in that answer are byte identical, and a test says so.
  return { ...starter, ...(storeName === undefined ? {} : { title: storeName }), blocks };
}
