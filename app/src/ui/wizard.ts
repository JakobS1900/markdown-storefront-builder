/**
 * The setup wizard: one question a screen, and a way out of every one of them.
 *
 * The empty state offers eight starting points and a blank page, which is a
 * choice between nine things to somebody who has not yet worked out what this
 * app is. This asks instead, one idea at a time, and hands back a page with
 * their own words already in it.
 *
 * WHAT THIS FILE IS AND IS NOT. It is the surface: the layer, the six screens,
 * the moves between them, and the keyboard handling. It decides nothing about
 * what an answer MEANS. Which starting point an answer chooses, where a store
 * name is written, how a selling mode reaches a row: all of that lives in
 * `wizard-answers.ts`, which has no DOM anywhere near it and is tested without
 * one. If a rule about the resulting page starts appearing in this file, it has
 * leaked out of the place it can be checked cheaply.
 *
 * WHY THIS IS HAND WRITTEN, again. A `<dialog>` with `showModal()` would give
 * the focus trap, escape, an inert background and top layer rendering for
 * nothing, and this project's rule is to take the platform feature. jsdom
 * implements neither `showModal` nor `inert`, proven by probe in feature 025
 * and recorded in `research.md` R1, and every user interface test here runs
 * under jsdom. Building on it would mean asserting against a stub of the exact
 * mechanism under test. So the trap, the escape and the backdrop are ours, and
 * each one has a test.
 *
 * The same file settled the element: a plain `div` with `role="dialog"`, never
 * an `aside`, because `aria-allowed-role` fails that and the a11y gate catches
 * it.
 */
import { SELLING_MODE_WORDS, serializeDocument } from "@mdsb/engine";
import type { Document } from "@mdsb/engine";

import { openBackup } from "../import.js";
import {
  answerWizard,
  clearBusy,
  getState,
  selectBlock,
  setBusy,
  setWizardStep,
  type State,
} from "../store.js";
import { STARTERS } from "../starters/index.js";
import { dismissWizard } from "../surface-history.js";
import { announce, button, el, field, trapFocus } from "./dom.js";
import { documentFromAnswers, starterIdFor } from "./wizard-answers.js";
import type { SellingMode, WizardAnswers } from "./wizard-answers.js";

/** The id the trigger points at, and the thing focus moves into. */
export const WIZARD_ID = "wizard-panel";

/**
 * One screen: what it asks, what it draws, and what skipping it takes back.
 *
 * `forget` is spelled out per question rather than derived, because a screen
 * asking two things has to take both back and nothing else can know that.
 */
interface Question {
  readonly heading: string;
  readonly help?: string;
  readonly ask: (answers: WizardAnswers, next: () => void) => Node[];
  readonly forget: () => void;
}

/**
 * A list of answers to one question, each of which is also the way forward.
 *
 * That a choice also advances is a judgement the spec does not make, and this
 * is the one it makes.
 *
 * Pressing a choice records it and moves on in one press, which is what a
 * wizard is for: a screen carrying one idea should not also carry a separate
 * "yes I mean it". The pressed state is what somebody walking back sees, so the
 * answer they gave is visible rather than remembered.
 *
 * That costs two repaints on one press, since recording and moving are two
 * writes to the store. A whole shell rebuild measured 37ms on a Moto G7, so
 * this is roughly a tenth of a second on the worst device we test on, once per
 * screen. The measurement that matters there was about a repaint PER KEYSTROKE,
 * which is a different thing entirely, and combining the two writes would mean
 * a store action that knows how the questions are ordered.
 */
function choices(opts: {
  readonly label: string;
  readonly chosen: string | undefined;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly onChoose: (value: string) => void;
  readonly next: () => void;
}): HTMLElement {
  return el(
    "ul",
    { class: "wizard-choices", "aria-label": opts.label },
    opts.options.map((option) =>
      el("li", {}, [
        button({
          label: option.label,
          variant: option.value === opts.chosen ? "primary" : "ghost",
          pressed: option.value === opts.chosen,
          onClick: () => {
            opts.onChoose(option.value);
            opts.next();
          },
        }),
      ]),
    ),
  );
}

/**
 * The four ways an item reaches a buyer, in the engine's own words.
 *
 * The cast is the one place this file has to assert something the compiler
 * cannot: `Object.entries` widens the keys of a `Record` to `string`, and these
 * keys are exactly the union `SellingMode` is defined as. Reading them from the
 * map rather than retyping them is FR-124, and it is why the cast is worth it:
 * a fifth mode added to the contract appears here on its own, and a copy of the
 * list in the app is the parallel definition the requirement exists to prevent.
 */
const MODES = Object.entries(SELLING_MODE_WORDS) as [SellingMode, string][];

/**
 * The six screens, in the order the data model implies.
 *
 * Six screens for seven answers. The item and its price share one, because an
 * item without its price is half an answer and nobody thinks of them
 * separately. FR-120 allows seven and this uses six, which leaves the seventh
 * screen for the finish.
 */
const QUESTIONS: readonly Question[] = [
  {
    heading: "What do you sell?",
    help: "This picks a starting point. Everything on it can be changed afterwards, and nothing here is final.",
    ask: (answers, next) =>
      [
        choices({
          label: "What you sell",
          chosen: answers.sells,
          // The eight that ship, plus an honest way of saying none of them. The
          // description is part of the name rather than decoration beside it,
          // exactly as in the starting point picker: "Art commissions" and
          // "Handmade and crafts" are a choice only once you know which one
          // covers what you sell.
          options: [
            ...STARTERS.map((starter) => ({
              value: starter.id,
              label: `${starter.label}. ${starter.description}`,
            })),
            { value: "other", label: "Something else. Start from a general one." },
          ],
          onChoose: (sells) => answerWizard({ sells }),
          next,
        }),
      ],
    forget: () => answerWizard({ sells: undefined }),
  },
  {
    heading: "What is your store called?",
    help: "This goes at the top of your page, where a buyer sees it.",
    ask: (answers) => [
      field({
        // The same label and the same hint the editor's About you form uses,
        // so the field somebody fills in here is recognisably the one they meet
        // again afterwards. It was briefly "Store name" here and "Your name"
        // there: one answer with two names depending on the screen. Both
        // reviews raised it and Jakob chose to rename the editor to match this
        // one, on 2026-09-09. If either moves, move both.
        label: "Store name",
        value: answers.storeName ?? "",
        hint: 'Your name or the handle people know you by: "Ridgeline Carry".',
        onInput: (storeName) => answerWizard({ storeName }),
      }),
    ],
    forget: () => answerWizard({ storeName: undefined }),
  },
  {
    heading: "Do you want a picture on your page?",
    help: "Either way you get the same page. This only decides what is open in front of you when it appears.",
    ask: (answers, next) => [
      choices({
        label: "Whether you want a picture",
        chosen: answers.wantsPicture === undefined ? undefined : String(answers.wantsPicture),
        options: [
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ],
        onChoose: (value) => answerWizard({ wantsPicture: value === "true" }),
        next,
      }),
    ],
    forget: () => answerWizard({ wantsPicture: undefined }),
  },
  {
    heading: "What is the first thing you sell?",
    help: "One is enough to start with. You can add the rest afterwards.",
    ask: (answers) => [
      field({
        // The same two labels and the same two hints the price row uses, so
        // the field somebody meets again in the editor is recognisably the one
        // they already filled in here.
        label: "Item",
        value: answers.firstItem ?? "",
        hint: 'What you are selling: "Carved oak sign", "Logo design", "Sourdough loaf".',
        onInput: (firstItem) => answerWizard({ firstItem }),
      }),
      field({
        label: "Price",
        value: answers.firstPrice ?? "",
        hint: 'Anything you like: "45", "from 45", or "DM me".',
        onInput: (firstPrice) => answerWizard({ firstPrice }),
      }),
    ],
    forget: () => answerWizard({ firstItem: undefined, firstPrice: undefined }),
  },
  {
    // "How is this available?" rather than "How does that reach a buyer?".
    //
    // The options come from `SELLING_MODE_WORDS` and one of the four is
    // "Sold out", which is not a way anything reaches a buyer, so the old
    // heading was a question its own answers did not all answer. Reading the
    // map rather than retyping it is FR-124 and is right; filtering it here to
    // save the wording would put the parallel list back. So the question moves
    // to fit the four answers that exist. Found by the holistic review at T048.
    //
    // The help says "If your page lists prices" because one starting point,
    // "Portfolio and about me", ships with no prices at all and drops this
    // answer on the floor by design (FR-122). The old wording promised that
    // wizard the word would be printed, and for that seller nothing is.
    heading: "How is this available?",
    help: "If your page lists prices, the word you pick here is the word it prints.",
    ask: (answers, next) => [
      choices({
        label: "How it is available",
        chosen: answers.mode,
        options: MODES.map(([value, label]) => ({ value, label })),
        onChoose: (value) => answerWizard({ mode: value as SellingMode }),
        next,
      }),
    ],
    forget: () => answerWizard({ mode: undefined }),
  },
  {
    heading: "What does that price buy?",
    help: "Leave this alone if the price is for one of something, which is the usual answer.",
    ask: (answers) => [
      field({
        label: "What the price buys",
        value: answers.amount ?? "",
        hint: 'Leave empty for one of something. Or: "per lb", "each", "per hour".',
        onInput: (amount) => answerWizard({ amount }),
      }),
    ],
    forget: () => answerWizard({ amount: undefined }),
  },
];

/** How many questions there are, for anything that needs to count screens. */
export const QUESTION_COUNT = QUESTIONS.length;

/** The step showing the finish, which sits one past the last question. */
const FINISH = QUESTIONS.length;

/**
 * Which section the page opens with, once it exists, as a block id.
 *
 * This is the whole of what `wantsPicture` does, and it deliberately does not
 * touch the document: two pages differing only in this answer are byte
 * identical, and `wizard-answers.test.ts` asserts it. Somebody who said yes
 * lands looking at a picture field instead of hunting for it, and that is a
 * fact about the screen rather than about the page, which is why it is decided
 * here and not there.
 *
 * IT TAKES THE STARTING POINT, and the first version did not. That version
 * returned the constant `"gallery"` and was wrong for five of the eight
 * starting points, because only `3d-printed-goods`, `handmade-and-crafts` and
 * `portfolio-and-about-me` ship with a gallery at all. The other five would
 * have had the answer quietly dropped while the screen promised "this only
 * decides what is open in front of you", which is a sentence that has to be
 * true for every starting point or it should not be on screen. The signature
 * was the defect: a function that never sees the page cannot choose a section
 * of it.
 *
 * Every starting point has a `profile`, and a profile carries `avatarUrl`, so
 * the fallback is a real picture field rather than a consolation. A gallery is
 * preferred where there is one because it holds as many pictures as somebody
 * wants, while a profile holds the one at the top.
 *
 * "No" and "not asked" answer the same way on purpose. There is no section this
 * feature wants open in either case, and inventing one to make the two
 * different would be choosing on somebody's behalf.
 *
 * `finish` below reads this once the page has opened and hands the id to
 * `selectBlock`. That call is the whole of what this decides, and its order
 * matters: `adopt` clears the selection, so selecting before the page opens
 * loses the answer without saying so.
 *
 * CHUNK 4: the spec-compliance review argued this belongs in
 * `wizard-answers.ts` rather than here, since taking a `Document` makes it a
 * rule about a page and this file says it holds no such rules. The counter is
 * that what it returns is a fact about the editor rather than about the page,
 * and nothing it decides reaches the saved bytes. Left here, and put to T048
 * rather than settled quietly in the chunk that wrote it.
 */
export function sectionToOpen(starter: Document, answers: WizardAnswers): string | undefined {
  if (answers.wantsPicture !== true) return undefined;
  const gallery = starter.blocks.find((block) => block.kind === "gallery");
  return (gallery ?? starter.blocks.find((block) => block.kind === "profile"))?.id;
}

/**
 * What the wizard says when it could not make the page.
 *
 * Its own sentence rather than the one `openBackup` returns. That message is
 * written for a file somebody chose off their device ("That file is not a saved
 * page"), which is nonsense to a person who has just answered six questions and
 * pressed one button. `starterPicker` meets the same problem and answers it half
 * way, by catching only the rejection and letting a resolved failure through in
 * the import's words.
 *
 * CHUNK 5: this goes further than that precedent and turns EVERY failure into
 * this sentence, which is a judgement the spec does not make. The argument for
 * it: a resolved `{ ok: false }` here can only mean `serializeDocument` produced
 * something `parseDocument` refuses, which is a bug in this app rather than
 * anything the seller did, and no wording about their file can describe it. The
 * argument against: it is the only place in the app that discards a message the
 * storage layer wrote, and a real defect would reach the seller as this
 * sentence rather than as the parser's complaint. Nothing is lost that a person
 * could have acted on either way, and "nothing has been changed" is the part
 * that is true in both cases.
 */
const COULD_NOT_MAKE = "Your page could not be made. Nothing has been changed.";

/**
 * Turns the answers into a page, the same way the starting point picker does.
 *
 * FR-123 and Principle V: `openBackup` opens what it is given as a NEW page
 * under its own id, so whatever was on screen is untouched and still saved. The
 * wizard never writes into the live document, which is what makes abandoning
 * halfway (FR-125) cost nothing rather than needing an undo of everything.
 *
 * THE THREE THINGS THAT WERE EASY TO GET WRONG HERE, all three found before
 * this was written rather than after, and all three still true of anything that
 * edits this function:
 *
 *   - **The answers are read before anything is dismissed.** `closeWizard`
 *     throws them away by design, so a dismiss on the way in would leave
 *     nothing to build a page from. `answers` is captured on the first line for
 *     that reason and the rest of this function uses the capture, not the
 *     store.
 *   - **The dismiss happens only in the success branch**, the way
 *     `starterPicker` calls `dismissSidebar()` only when a page really opened.
 *     A failure with the layer already gone leaves a message on a screen with
 *     nothing on it to explain what the message is about.
 *   - **`selectBlock` runs after `openBackup` has resolved**, and this is the
 *     one that had already nearly been lost twice. `adopt` sets
 *     `selectedBlockId: undefined` as part of opening a page, deliberately,
 *     because block ids survive a reopen and a stale selection can go on
 *     matching rows in a document nobody touched. Selecting the section before
 *     that lands means `wantsPicture` is silently wiped and the answer does
 *     nothing at all, while the screen that asked for it promised otherwise.
 *
 * The busy line and the catch are `starterPicker`'s, for the reason it gives at
 * length: `load()` is a dynamic import of a lazy chunk, about thirty ticks
 * cold, and without something on screen the press reads as a dead button. The
 * catch covers a rejection, which is the offline `load()` and a
 * `serializeDocument` throw.
 *
 * A DOUBLE PRESS IS GUARDED, and the reasoning that said it need not be was
 * wrong in a way worth keeping. It read: the worst a second press can do is
 * leave one spare saved page, nothing is lost or overwritten, so match
 * `starterPicker` and do not bother. The page half was right and the history
 * half was never checked.
 *
 * `dismissWizard` goes through `history.back()`, which is asynchronous. Both
 * presses land before the first finishes, because the work is a dynamic import
 * and an IndexedDB write, and the `setBusy` repaint rebuilds this button
 * enabled. The second chain therefore still sees `wizardOwnsHistory()` as true
 * and queues a SECOND back. The first spends the wizard's own entry and the
 * second spends the entry underneath it, which on the Build surface is the one
 * whose consumption leaves the app. So the real worst case was closing the app
 * on somebody who tapped twice, not a spare page.
 *
 * Disabling the button cannot fix it, which is why the guard is a module flag.
 * `setBusy` repaints, `render` calls `replaceChildren`, and the disabled button
 * is replaced by a freshly drawn enabled one before a thumb could land again.
 * That is worth knowing beyond here: the example button on the empty state
 * guards itself exactly that way and is defeated exactly that way, and only its
 * lighter consequence has hidden it.
 *
 * The flag survives the repaint because it is module state, the same reason
 * `wasOpen` below is, and `finally` clears it on every path including a
 * rejection.
 */
let making = false;

function finish(): void {
  // One at a time. See above: the second press spends a history entry that
  // belongs to the surface underneath, and back from Build leaves the app.
  if (making) return;

  // First, before anything can dismiss the layer. See above.
  const answers = getState().wizardAnswers;
  const starter = STARTERS.find((one) => one.id === starterIdFor(answers));

  if (starter === undefined) {
    // Unreachable as the code stands: every id `starterIdFor` can return comes
    // from `STARTERS` itself, or is `DEFAULT_STARTER_ID`, which
    // `wizard-answers.test.ts` asserts the loader actually found. Handled as an
    // ordinary failure rather than thrown, because a person pressing "Make my
    // page" is owed a sentence and not a stack trace, and because the assertion
    // that keeps it unreachable lives in another file.
    announce(COULD_NOT_MAKE);
    return;
  }

  making = true;
  setBusy("Making your page");
  void starter
    .load()
    .then((template) => {
      const doc = documentFromAnswers(template, answers);
      // Read from the document being opened rather than from the template.
      // They carry the same block ids, since `documentFromAnswers` rewrites
      // fields and never mints an id, but the id this hands to `selectBlock`
      // has to name a block in the page that actually appears.
      const section = sectionToOpen(doc, answers);
      return openBackup(serializeDocument(doc)).then((result) => ({
        ok: result.ok,
        section,
      }));
    })
    .catch(() => ({ ok: false, section: undefined }))
    .then(({ ok, section }) => {
      clearBusy();
      if (!ok) {
        announce(COULD_NOT_MAKE);
        return;
      }
      // After the page has opened, never before it. `adopt` clears the
      // selection on its way in, and a `selectBlock` in front of it is wiped
      // without a word: proved by moving this line up, which turns the picture
      // answer into `undefined` and leaves every other assertion green.
      //
      // Before the dismiss rather than after it, which is a smaller point and
      // still worth the order. Dismissing can close the layer synchronously,
      // when no history entry was taken, and that repaint runs the focus
      // landing. With the selection not yet made, the landing has nothing
      // better to aim at than the first row of the page, and only a later
      // repaint corrects it. Selecting first means the first attempt is already
      // right, and the two ways out of the layer stop differing for no reason.
      if (section !== undefined) selectBlock(section);
      dismissWizard();
      announce(`Made your page from ${starter.label}. Change anything you like.`);
    })
    // On every path, including the rejection above, or a failed attempt would
    // lock the button for the life of the module and the wizard could never
    // finish again.
    .finally(() => {
      making = false;
    });
}

/** Back, skip and forward, the same three on every question. */
function moves(step: number, question: Question): HTMLElement {
  const goTo = (to: number): void => {
    setWizardStep(Math.min(to, FINISH));
  };

  return el("div", { class: "wizard-moves" }, [
    // Absent on the first question rather than disabled, because there is
    // nothing behind it and a control that cannot do anything is still a
    // control a thumb has to skip past.
    ...(step === 0 ? [] : [button({ label: "Back", onClick: () => goTo(step - 1) })]),
    // Skip is not another Next. It takes the answer back as well as
    // moving on, which is what makes it safe on a question somebody has walked
    // back to and decided against: FR-120 says every question is skippable, and
    // a skipped question has to leave the starting point's own content alone.
    //
    // The spec does not settle what Skip means on a question that was already
    // answered, and this is the choice made. The alternative reading, that Skip
    // is simply a second way forward, leaves two controls doing one thing and
    // no way at all to take an answer back once given.
    button({
      label: "Skip this question",
      onClick: () => {
        question.forget();
        goTo(step + 1);
      },
    }),
    button({ label: "Next", variant: "primary", onClick: () => goTo(step + 1) }),
  ]);
}

function questionScreen(question: Question, answers: WizardAnswers, step: number): Node[] {
  const next = (): void => {
    setWizardStep(Math.min(step + 1, FINISH));
  };

  return [
    el("p", { class: "wizard-progress" }, [
      `Question ${String(step + 1)} of ${String(QUESTIONS.length)}`,
    ]),
    el("h2", {}, [question.heading]),
    ...(question.help === undefined ? [] : [el("p", { class: "wizard-help" }, [question.help])]),
    ...question.ask(answers, next),
    moves(step, question),
  ];
}

function finishScreen(): Node[] {
  return [
    el("h2", {}, ["That is everything I need."]),
    el("p", { class: "wizard-help" }, [
      "Your page is made from one of the templates, with whatever you told me already filled in. Nothing on it is fixed, and anything you skipped is just the template's own words waiting to be changed.",
    ]),
    el("div", { class: "wizard-moves" }, [
      button({ label: "Back", onClick: () => setWizardStep(FINISH - 1) }),
      button({ label: "Make my page", variant: "primary", onClick: finish }),
    ]),
  ];
}

/**
 * The layer, built only when it is open.
 *
 * A closed wizard adds nothing to the DOM and costs nothing per repaint, which
 * is the same rule the drawer and the preview pane follow: the shell rebuilds
 * its whole interface on every keystroke, and a rebuild measured 37ms on a
 * Moto G7.
 *
 * The backdrop is a sibling of the panel rather than its parent, so dismissing
 * by tapping outside is a click on a known element rather than a guess about
 * where a click landed.
 */
export function wizardLayer(state: State): HTMLElement {
  // Clamped here because this is the only place that knows how many screens
  // there are. `setWizardStep` guards the lower bound and cannot guard this one
  // without importing the list, which would be a cycle.
  const step = Math.min(Math.max(state.wizardStep, 0), FINISH);
  const question = QUESTIONS[step];

  const panel = el(
    // A plain `div`, not an `aside`. An `aside` is already a `complementary`
    // landmark and `role="dialog"` is not a role it is allowed to take, which
    // axe reports as `aria-allowed-role`. Feature 025 met this exact rule and
    // the answer is the same: change the element, not the role.
    "div",
    {
      id: WIZARD_ID,
      class: "wizard-panel",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Set up your page",
      // So the panel itself can hold focus on opening, and on any repaint that
      // destroys the control somebody was on, without stealing it from a
      // control they have not chosen yet.
      tabindex: "-1",
    },
    [
      button({
        label: "Close setup",
        glyph: "×",
        onClick: () => {
          dismissWizard();
        },
      }),
      ...(question === undefined ? finishScreen() : questionScreen(question, state.wizardAnswers, step)),
    ],
  );

  panel.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      dismissWizard();
      return;
    }
    trapFocus(panel, event);
  });

  const backdrop = el("div", { class: "wizard-backdrop" }, []);
  backdrop.addEventListener("click", (event: MouseEvent) => {
    // Stopped here rather than allowed to travel on. A dismissing tap must not
    // also press whatever happened to be under it.
    event.stopPropagation();
    dismissWizard();
  });

  return el("div", { class: "wizard" }, [backdrop, panel]);
}

/**
 * Moves focus in when the wizard opens and back to the trigger when it closes.
 *
 * Called after every render, and it acts only on a CHANGE, which is the part
 * that matters. The shell rebuilds its whole interface on every keystroke, so
 * focusing the panel whenever it happens to be open would take the caret out of
 * the field somebody is typing their store name into.
 */
let wasOpen = false;

/**
 * How many more repaints the landing below may act on.
 *
 * A plain flag was the first version and could not be cleared: nothing survives
 * a repaint, so "focus is on the body" is true at the start of essentially
 * every render, and a landing that retried whenever that held would retry for
 * the life of the page and pull focus off whatever a person had tabbed to.
 *
 * A wall clock was the second, and this is a countdown instead because repaints
 * are the thing actually being bounded. Opening a page fires a short burst of
 * them and this has to survive the burst; a duration was only ever a proxy for
 * that, chosen to be comfortably longer, unverified because nothing tests an
 * expiry, and a clock read on the render path in a project whose engine bans
 * `Date.now` on principle. A count bounds the real quantity, is deterministic,
 * and can be asserted.
 *
 * It is spent only on repaints where focus is on the body, so a burst that
 * settles early costs nothing, and it stops either when something else holds
 * focus or when the allowance runs out.
 */
let landingLeft = 0;
const LANDING_REPAINTS = 4;

export function syncWizardFocus(open: boolean, trigger: HTMLElement | null): void {
  // Two reasons to take focus, and the second is not obvious. It is also the
  // one that does the most work here, because moving between questions
  // destroys the button that was pressed on every single press.
  //
  // The wizard has just opened, which is the ordinary one. Or it is open and
  // focus has fallen to the body, which happens on any repaint that destroys
  // the control somebody was on: the shell rebuilds its whole interface, and
  // only form fields get their caret put back. A modal that lets focus land on
  // the body behind it is not containing anything, and tab from there walks
  // straight into a page nobody can see. Landing on the panel also means the
  // dialog's own name is read again, which is the closest thing this has to
  // announcing a new question.
  //
  // Both conditions require focus to be nowhere useful, so neither can pull the
  // caret out of a field somebody is typing into.
  const lost = document.activeElement === document.body;

  if (open && (!wasOpen || lost)) {
    document.getElementById(WIZARD_ID)?.focus({ preventScroll: true });
  } else if (!open && wasOpen) {
    // The trigger, when there still is one. Closing without finishing leaves
    // the empty state exactly as it was, so the control is redrawn and focus
    // goes straight back to where it came from.
    //
    // FINISHING DESTROYS IT. The trigger is drawn by the empty state, and a
    // finished wizard has just replaced that empty state with a page, so
    // `renderShell` finds nothing by `aria-controls` and hands this a null.
    // Focus then sat on the body: somebody answered six questions, pressed the
    // one button, and was put at the top of a document they had never seen with
    // nothing to say where they were. The comment at the trigger in `build.ts`
    // used to claim this could not happen, and was corrected in the same change
    // as this. It went unseen because the assertion that covers it was written
    // for the close path next door.
    if (trigger !== null) trigger.focus({ preventScroll: true });
    else landingLeft = LANDING_REPAINTS;
  }
  wasOpen = open;

  // The landing, which cannot be done in one go. Focusing once works and then
  // stops being true: opening a page fires several more repaints of its own,
  // each calls `replaceChildren`, and the control focused a moment ago is gone
  // with focus back on the body. Only fields are put back, by `restoreCaret`,
  // which runs after this and therefore wins whenever a caret is what is really
  // being restored.
  //
  // Guarded on the wizard being CLOSED as well as on the allowance. `lost` is
  // read at the top of this function and is stale by here: the branch above may
  // have just focused the panel while `lost` still reads true. Without the
  // guard, an allowance still standing when the wizard reopened would pull
  // focus straight back out of the layer and onto a control in the inert
  // surface behind it. Unreachable today only because an armed allowance
  // implies the empty state is gone, which implies there is no trigger to
  // reopen from, and that is an accident of `showsEmptyState` rather than a
  // guarantee this should rest on.
  if (!open && landingLeft > 0) {
    if (!lost) landingLeft = 0;
    else {
      landingLeft -= 1;
      intoTheNewPage()?.focus({ preventScroll: true });
    }
  }
}

/**
 * Where focus lands when the wizard has just made a page and gone.
 *
 * The section the picture answer opened, when there is one, because that is the
 * whole of what that answer does: somebody who said yes should be looking at a
 * picture field rather than hunting for it, and "looking at" is focus for
 * anybody not using their eyes. Otherwise the first section of the new page,
 * which is the top of the thing they just made.
 *
 * Read out of the document rather than remembered from `finish`, because the
 * repaint that closes the layer destroys whatever was focused before it and
 * this runs after that repaint. A node captured earlier would be stale.
 */
function intoTheNewPage(): HTMLElement | null {
  // Asked for by id rather than by "whichever row carries an `aria-controls`".
  // That shorter selector worked, and only because `build.ts` sets the
  // attribute on a row ONLY while that row is selected, which it does for an
  // unrelated reason: a dangling reference to a form that is not rendered. So
  // the right answer came out of a decision made somewhere else about something
  // else, and anyone who later decides a dangling `aria-controls` is acceptable
  // turns this into "the first block on the page", silently, on the one path in
  // this feature nobody looks at.
  const selected = getState().selectedBlockId;
  const open =
    selected === undefined
      ? null
      : document.querySelector<HTMLElement>(`#surface [aria-controls="editor-${selected}"]`);
  // Nothing selected means the picture question was skipped or answered no, and
  // then the top of the page they just made is the honest place to be.
  return open ?? document.querySelector<HTMLElement>("#surface .blocks button");
}

/** Test seam: this module keeps state across repaints and a test needs it reset. */
export function resetWizardFocusTracking(): void {
  wasOpen = false;
  landingLeft = 0;
  making = false;
}
