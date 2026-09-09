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
import { SELLING_MODE_WORDS } from "@mdsb/engine";
import type { Document } from "@mdsb/engine";

import { answerWizard, setWizardStep, type State } from "../store.js";
import { STARTERS } from "../starters/index.js";
import { dismissWizard } from "../surface-history.js";
import { button, el, field, trapFocus } from "./dom.js";
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
 * CHUNK 4: that a choice also advances is a judgement the spec does not make.
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
    heading: "How does that reach a buyer?",
    help: "The word you pick here is the word your page prints.",
    ask: (answers, next) => [
      choices({
        label: "How it reaches a buyer",
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
 * CHUNK 4: nothing calls this yet. Phase 5 (T037) reads it when the page is
 * opened and passes the id to `selectBlock`, which is the point at which it
 * starts mattering. It is exported and tested now because the answer it depends
 * on is recorded now.
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
 * CHUNK 4: THE SEAM PHASE 5 LANDS IN, and the only thing here left unfinished
 * on purpose.
 *
 * T037 replaces this body with `openBackup(serializeDocument(doc))`, built from
 * `documentFromAnswers` and the starting point `starterIdFor` names, wrapped in
 * the same `setBusy` and offline `load()` catch that `starterPicker` already
 * carries. That is FR-123: the wizard creates its page the same way the picker
 * does, as a NEW page, leaving whatever was open untouched.
 *
 * FOUR THINGS THE NEXT IMPLEMENTER MUST NOT GET WRONG:
 *
 *   - Read `getState().wizardAnswers` BEFORE dismissing. `closeWizard` throws
 *     the answers away by design, so a dismiss on the way in leaves nothing to
 *     build a page from.
 *   - Dismiss only once the page has actually opened, the way `starterPicker`
 *     calls `dismissSidebar()` inside the success branch and not before. A
 *     failure with the wizard already gone leaves the message with nothing on
 *     screen to explain it.
 *   - **Call `rememberWizardOpen()` at the trigger, immediately before
 *     `openWizard()`**, exactly as `shell.ts` pairs `rememberSidebarOpen()`
 *     with `openSidebar()`. `surface-history.ts` has the function and the
 *     `popstate` branch that consumes its entry, and NOTHING IN THE APP CALLS
 *     IT: only the tests do, by hand. Until T036 pairs them, FR-133 is wired on
 *     one side only, and the first back gesture on the Build surface leaves the
 *     app before any `popstate` fires, because Build deliberately pushes
 *     nothing. Found by the chunk 4 spec review, not by a test, because the
 *     test supplies the entry itself.
 *   - **The trigger must carry `aria-controls="wizard-panel"` and must be
 *     inside `#app`.** `renderShell` finds it with `root.querySelector`, and
 *     that lookup is the one part of the focus restore nothing proves today:
 *     the test at `wizard.test.ts` supplies its own trigger and says so. It
 *     cannot do better within this chunk, because `render` calls
 *     `replaceChildren` on the root, so a trigger a test appends is destroyed
 *     by the next repaint. The control Phase 5 draws is what makes that path
 *     testable, and T035 is where the assertion belongs.
 *
 * Until then this closes the wizard and creates nothing, which is honest rather
 * than convenient: FR-125 says abandoning must create nothing, and an
 * unfinished finish is indistinguishable from abandoning.
 */
function finish(): void {
  dismissWizard();
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
    // CHUNK 4: skip is not another Next. It takes the answer back as well as
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
    trigger?.focus({ preventScroll: true });
  }
  wasOpen = open;
}

/** Test seam: the focus tracker is module state and a test needs it reset. */
export function resetWizardFocusTracking(): void {
  wasOpen = false;
}
