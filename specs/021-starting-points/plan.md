# Starting Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single hardcoded example with eight starting points, each
a complete page for one kind of seller, reachable both by somebody who has just
arrived and by somebody starting their second page.

**Architecture:** Two files per starting point in `app/src/starters/`, sharing a
stem: a tiny `.meta.ts` carrying the label and description, and a `.json`
carrying the `Document`. The metas are globbed eagerly so the picker can list
them, the documents lazily so each is its own chunk. Choosing one goes through
`openBackup`, the same path the example and file import already use, so a
starting point inherits validation, a new page id, and the guarantee that it
cannot overwrite the page already open. A test globs the same directory and
refuses any starting point that does not compile clean on every target.

**Tech Stack:** TypeScript strict, Vite, Vitest, jsdom for surface tests,
`fake-indexeddb` for storage tests. No new dependencies.

**Spec:** `specs/021-starting-points/spec.md`

**Plan location note:** This plan lives beside its spec rather than under
`docs/superpowers/plans/`, matching this project's own convention. Features 001
and 002 both keep `plan.md` next to `spec.md`.

## Global Constraints

- **No em dashes and no en dashes anywhere.** Code, comments, commit messages,
  docs, UI copy. `npm run dashscan` enforces it and is part of `npm run verify`.
- **No AI attribution in commit messages.** No co-author trailer, no "generated
  with", no mention of an AI. Commit as `JakobS1900`, already set in git config.
- **Commit locally, never push.**
- **Never use `--no-verify`.** If a hook fails, fix the cause.
- **Run npm from PowerShell, not the Bash tool.** Under msys2 Git Bash, npm
  picks up the msys2 cache and fails with `ERR_INVALID_ARG_TYPE` plus `EPERM`.
- **`Select-Object -First N` corrupts the exit code.** Never check a gate's
  status through a truncating pipe. Run the gate alone.
- **Do NOT append to files with `cat >>` through the Bash tool.** It has
  destroyed two files in this repo. Use Write or Edit.
- **`@typescript-eslint/no-non-null-assertion` is an error in `app/tests/**`.**
  The exemption in `eslint.config.js:66` covers `engine/tests` only. No `!` in
  any app test.
- **`noUncheckedIndexedAccess` is on.** Every array index and every index
  signature read is `T | undefined` and must be narrowed.
- **`exactOptionalPropertyTypes` is on.** An optional property is absent or a
  real value. Never `undefined`, never `null`.
- **`verbatimModuleSyntax` is on.** Type-only imports must use
  `import type { ... }`.
- **`no-console` is an error.** Nothing prints.
- **Relative imports carry the `.js` extension**, including from `.ts` files.
  This is the existing convention throughout the repo.

---

### Task 1: The starter loader, one starting point, and the gate

The whole mechanism proved end to end on one file, with the gate that every
later starting point will be judged by. Nothing here touches the UI.

**Files:**
- Create: `app/src/starters/index.ts`
- Create: `app/src/starters/art-commissions.meta.ts`
- Create: `app/src/starters/art-commissions.json`
- Test: `app/tests/starters.test.ts`

**Interfaces:**
- Consumes: `Document`, `validateDocument`, `compile`, `TARGETS` from
  `@mdsb/engine`. All four are confirmed exported from
  `engine/src/document/index.ts` and `engine/src/compile/index.ts`.
- Produces: `STARTERS: readonly Starter[]` and `interface Starter { id: string;
  label: string; description: string; load: () => Promise<Document> }`, both
  from `app/src/starters/index.js`. Task 2 renders `STARTERS` and calls
  `load()`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/starters.test.ts`. It asserts four things: that the loader
finds the starting points on disk, that every `.meta.ts` has a `.json` beside
it and the reverse, that every document is valid, and that every document
compiles with zero diagnostics against every target the engine knows.

The pairing check reads the directory with `node:fs` rather than the glob, on
purpose. Reading the same glob the loader reads would only prove the loader
agrees with itself. Reading the filesystem independently is what proves the
promise in FR-053b, that dropping files into a directory is all it takes.

```ts
/**
 * Every starting point, judged by the same gate.
 *
 * Globbing rather than listing is the point. A starting point contributed later
 * is gated on the day it lands, and this file does not change when the set
 * grows.
 *
 * Zero diagnostics rather than "compiles": a starting point that trips a
 * capability fallback is teaching somebody a shape their host cannot render,
 * which is worse than offering them nothing.
 */
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { TARGETS, compile, validateDocument } from "@mdsb/engine";

import { STARTERS } from "../src/starters/index.js";

const DIR = fileURLToPath(new URL("../src/starters/", import.meta.url));

function stems(suffix: string): string[] {
  return readdirSync(DIR)
    .filter((name) => name.endsWith(suffix))
    .map((name) => name.slice(0, -suffix.length))
    .sort();
}

describe("the starting points on disk", () => {
  it("are all found by the loader", () => {
    expect(STARTERS.length).toBeGreaterThan(0);
    expect(STARTERS.map((s) => s.id).sort()).toEqual(stems(".json"));
  });

  it("each have a description beside their document, and the reverse", () => {
    // FR-053b. Adding a starting point is dropping files into this directory,
    // so a half-added one has to fail here rather than vanish silently.
    expect(stems(".meta.ts")).toEqual(stems(".json"));
  });

  it("each say who they are for", () => {
    for (const starter of STARTERS) {
      expect(starter.label).not.toBe("");
      expect(starter.description).not.toBe("");
    }
  });
});

describe("every starting point", () => {
  it("is a valid page", async () => {
    for (const starter of STARTERS) {
      const doc = await starter.load();
      const result = validateDocument(doc);
      // Named so a failure says which one, rather than "expected true".
      expect(result.ok ? [] : result.issues.map((i) => `${i.path}: ${i.message}`))
        .toEqual([]);
    }
  });

  it("compiles with no diagnostics on any host", async () => {
    for (const starter of STARTERS) {
      const doc = await starter.load();
      for (const target of TARGETS) {
        const result = compile(doc, target);
        expect(
          result.diagnostics.map((d) => `${starter.id} on ${target.id}: ${d.message}`),
        ).toEqual([]);
      }
    }
  });

  it("produces a page with something on it", async () => {
    // A starting point that compiles to nothing passes every check above and
    // is useless. Three sections is the floor for demonstrating what a page is.
    for (const starter of STARTERS) {
      const doc = await starter.load();
      expect(doc.blocks.length).toBeGreaterThanOrEqual(3);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from PowerShell:

```
npx vitest run app/tests/starters.test.ts
```

Expected: FAIL. The import of `../src/starters/index.js` cannot be resolved,
because neither the module nor the directory exists yet.

- [ ] **Step 3: Write the loader**

Create `app/src/starters/index.ts`:

```ts
/// <reference types="vite/client" />
/**
 * The starting points, discovered rather than listed.
 *
 * Adding one is dropping two files into this directory. Nothing here changes,
 * no list is edited, and `app/tests/starters.test.ts` gates the new one on the
 * day it lands.
 *
 * Two files rather than one self-describing file, because a file cannot be read
 * for its label without being loaded. The metas are eager, since the picker
 * has to show every label before anything is chosen; the documents are lazy, so
 * each is its own chunk and none is downloaded until somebody picks it.
 * Measured on 2026-09-02: the one-file version emitted no lazy chunks at all
 * and put every payload in the main bundle. The reasoning is in
 * `specs/021-starting-points/spec.md` under "Why two files, measured".
 */
import type { Document } from "@mdsb/engine";

interface Meta {
  readonly label: string;
  readonly description: string;
}

export interface Starter {
  /** The shared filename stem, for example `art-commissions`. */
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly load: () => Promise<Document>;
}

const META_SUFFIX = ".meta.ts";

const metas = import.meta.glob<Meta>("./*.meta.ts", { eager: true, import: "meta" });
const documents = import.meta.glob<Document>("./*.json", { import: "default" });

/**
 * Sorted by id rather than by label, and deliberately not with
 * `localeCompare`, which answers differently depending on where the browser
 * thinks it is. The order a person sees should not depend on that.
 */
export const STARTERS: readonly Starter[] = Object.entries(metas)
  .flatMap(([path, meta]) => {
    const id = path.slice("./".length, -META_SUFFIX.length);
    const load = documents[`./${id}.json`];
    // A meta with no document beside it is a half-added starting point. It is
    // dropped here rather than thrown, so a mistake in this directory cannot
    // stop the app from opening, and the test above fails loudly instead.
    return load === undefined ? [] : [{ id, label: meta.label, description: meta.description, load }];
  })
  .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
```

- [ ] **Step 4: Write the first starting point's description**

Create `app/src/starters/art-commissions.meta.ts`:

```ts
export const meta = {
  label: "Art commissions",
  description: "Tiers, slots, terms, and examples",
};
```

- [ ] **Step 5: Write the first starting point's document**

Create `app/src/starters/art-commissions.json`. Follow the honesty rule from the
spec exactly: identity fields carry instructions, structure fields carry
realistic content. `displayName` is "Your name or handle", not a plausible
artist's name, because a page claiming to be somebody who is not the person
holding it is the one lie this app must never write for them.

Note `"schemaVersion": 2` and that `id` values need only be unique within this
one document.

```json
{
  "schemaVersion": 2,
  "target": "rentry",
  "title": "Commissions",
  "blocks": [
    {
      "id": "profile",
      "kind": "profile",
      "displayName": "Your name or handle",
      "tagline": "What you draw, in one line",
      "status": "open",
      "links": [
        { "label": "Your gallery", "url": "https://example.com/your-gallery" }
      ],
      "paymentMethods": ["PayPal", "Ko-fi"]
    },
    {
      "id": "prices",
      "kind": "menu",
      "heading": "Prices",
      "currency": "USD",
      "tiers": [
        {
          "name": "Bust",
          "price": "35",
          "unit": "per character",
          "blurb": "Head and shoulders, flat colour",
          "includes": ["One revision", "Full resolution file"]
        },
        {
          "name": "Half body",
          "price": "60",
          "unit": "per character",
          "blurb": "Waist up, flat colour",
          "includes": ["Two revisions", "Full resolution file"]
        },
        {
          "name": "Full body",
          "price": "95",
          "unit": "per character",
          "blurb": "Head to toe, shaded",
          "includes": ["Two revisions", "Full resolution file", "Transparent background"]
        },
        {
          "name": "Something else",
          "price": "DM me",
          "blurb": "Backgrounds, group pieces, anything not listed"
        }
      ],
      "addOns": [
        { "name": "Extra character", "price": "+75%" },
        { "name": "Simple background", "price": "15" },
        { "name": "Commercial use", "price": "+100%" }
      ]
    },
    {
      "id": "terms",
      "kind": "prose",
      "heading": "Terms",
      "text": "Payment up front. Turnaround is usually one to two weeks and I will tell you if it will be longer. I will send a sketch before colouring, and revisions happen at that stage. Replace this with your own terms."
    },
    {
      "id": "will-and-wont",
      "kind": "prose",
      "heading": "What I will and will not draw",
      "text": "Say here what you are happy to take on and what you are not. Being specific saves you turning people down later."
    },
    { "id": "rule", "kind": "divider" },
    {
      "id": "how-to-order",
      "kind": "prose",
      "heading": "How to order",
      "text": "Message me with what you want, which tier it is, and any references. I will confirm the price before you pay."
    }
  ]
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run from PowerShell:

```
npx vitest run app/tests/starters.test.ts
```

Expected: PASS, all six assertions.

If "compiles with no diagnostics on any host" fails, the message names the
starting point, the host, and the diagnostic. Do NOT relax the assertion. Change
the document until it compiles clean on all three of portable, rentry and
text.is. That is what the gate is for.

**The gate is known to be achievable, measured on 2026-09-02 rather than
assumed.** All three targets declare `tables: true`, so a menu never degrades
and `table_unsupported` cannot fire. All three declare `maxHeadingLevel: 6`, so
`heading_level_reduced` cannot fire either. The shipped `app/public/example.json`
was compiled against all three and produced an empty diagnostics list. The
diagnostics a starting point could realistically trip are therefore
`link_scheme_refused`, which is why every URL must be an `https://example.com`
one, `section_empty` for a block left with nothing in it, and
`size_limit_exceeded`, which needs 200,000 bytes on text.is and is not a
practical risk for a page of this size.

- [ ] **Step 7: Verify the types build, including the Vite glob types**

Run from PowerShell, each alone so no truncating pipe corrupts the exit code:

```
npm run typecheck
npm run lint
```

Expected: both clean.

`import.meta.glob` is typed by `vite/client`, which is pulled in by the
`/// <reference types="vite/client" />` on the first line of the loader. Neither
`app/tsconfig.json` nor `tsconfig.test.json` lists it in `types`, and the
reference is what makes it work in both without editing either. If typecheck
reports `Property 'glob' does not exist on type 'ImportMeta'`, that line is
missing or has been moved below an import.

- [ ] **Step 8: Verify the documents stay out of the main bundle**

This is the property the two-file split exists for, so it gets checked once by
hand here rather than assumed for the rest of the feature.

Run from PowerShell:

```
npm run build:app
```

Expected: a chunk named `art-commissions-<hash>.js` listed separately from
`index-<hash>.js`. Then confirm the payload is not in the entry chunk:

```
Select-String -Path app/dist/assets/index-*.js -Pattern "Bust" -Quiet
```

Expected: `False`. The tier name lives in the starting point's own chunk.

```
Select-String -Path app/dist/assets/index-*.js -Pattern "Art commissions" -Quiet
```

Expected: `True`. The label is in the entry chunk, which is what lets the picker
list it without downloading anything.

- [ ] **Step 9: Commit**

```bash
git add app/src/starters app/tests/starters.test.ts
git commit -m "feat(starters): discover starting points, and gate them on compiling clean"
```

---

### Task 2: The picker

Both entrances, sharing one component. Nothing new in the store.

**Files:**
- Modify: `app/src/ui/build.ts` (the `pageList` adders div near line 235, and
  `emptyState` near line 266)
- Modify: `app/src/styles.css` (one rule for the list)
- Test: `app/tests/starters-picker.test.ts`

**Interfaces:**
- Consumes: `STARTERS` and `Starter` from `../starters/index.js`,
  `openBackup` from `../import.js`, `serializeDocument` from `@mdsb/engine`,
  and `announce`, `button`, `disclosure`, `el` from `./dom.js`. All are already
  imported by `build.ts` except `STARTERS` and `serializeDocument`.
- Produces: nothing importable. This task is UI only.

- [ ] **Step 1: Write the failing test**

Create `app/tests/starters-picker.test.ts`. The harness mirrors
`app/tests/example.test.ts`, which is the closest existing test and the one
this feature sits beside.

Note the two things this test exists to catch, both of which a first pass would
miss: that the picker is reachable by somebody with no saved pages at all, and
that choosing a starting point leaves the page already open alone.

```ts
/**
 * @vitest-environment jsdom
 *
 * Choosing a starting point.
 *
 * Two of these are about placement rather than behaviour, and they are the
 * reason the picker is rendered twice. `pageList` returns nothing when there
 * are no saved pages (`build.ts:130`), which is correct and which would have
 * hidden this feature from the only person it was built for.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { addBlock, getState, init, subscribe } from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";
import { renderShell } from "../src/ui/shell.js";

let stop: (() => void) | undefined;

function live(): HTMLElement {
  document.body.innerHTML =
    '<a class="skip" href="#surface">Skip</a><div id="app"></div>' +
    '<div id="live-region" class="sr-only" role="status" aria-live="polite"></div>';
  const root = document.getElementById("app");
  if (root === null) throw new Error("missing #app");
  init(true);
  stop = subscribe(() => renderShell(root));
  renderShell(root);
  return root;
}

function starterButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>(".starters button")];
}

async function settle(): Promise<void> {
  for (let i = 0; i < 12; i += 1) await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  stop?.();
  stop = undefined;
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  stop?.();
  stop = undefined;
});

describe("the starting point picker", () => {
  it("is reachable by somebody who has nothing saved at all", () => {
    live();
    // The empty state. There is no pages group at this point, by design.
    expect(document.querySelector(".pages-group")).toBeNull();
    expect(starterButtons().length).toBeGreaterThan(0);
  });

  it("names every starting point and says who each is for", () => {
    live();
    for (const b of starterButtons()) {
      const name = b.getAttribute("aria-label") ?? b.textContent ?? "";
      expect(name.trim()).not.toBe("");
    }
  });

  it("leaves the blank path exactly one press", () => {
    const root = live();
    addBlock(blankBlock("profile"));
    renderShell(root);
    const blank = [...document.querySelectorAll<HTMLButtonElement>("#app button")]
      .find((b) => (b.textContent ?? "").includes("Start a new page"));
    expect(blank).toBeDefined();
  });

  it("opens a starting point as its own page, leaving the open one alone", async () => {
    const root = live();
    addBlock(blankBlock("profile"));
    renderShell(root);
    const before = getState().pageId;

    const first = starterButtons()[0];
    expect(first).toBeDefined();
    first?.click();
    await settle();
    renderShell(root);

    expect(getState().pageId).not.toBe(before);
    expect(getState().doc.blocks.length).toBeGreaterThanOrEqual(3);
    // The page that was open is still in storage, which is the whole contract
    // `openBackup` exists to keep.
    expect(getState().pages.some((p) => p.id === before)).toBe(true);
  });

  it("says what it did, without the wording meant for a file import", async () => {
    const root = live();

    starterButtons()[0]?.click();
    await settle();
    renderShell(root);

    const said = document.getElementById("live-region")?.textContent ?? "";
    expect(said).not.toBe("");
    // `openBackup` says "the page you had open is still saved", which is right
    // for a backup and meaningless for a template.
    expect(said).not.toContain("backup");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from PowerShell:

```
npx vitest run app/tests/starters-picker.test.ts
```

Expected: FAIL on the first case, "is reachable by somebody who has nothing
saved at all", because no element matches `.starters button`.

- [ ] **Step 3: Add the picker to `build.ts`**

Add these two imports to the existing import block at the top of
`app/src/ui/build.ts`. `serializeDocument` joins the existing
`import type { Block } from "@mdsb/engine";`, which must become a value import
alongside the type import:

```ts
import { serializeDocument, type Block } from "@mdsb/engine";

import { STARTERS } from "../starters/index.js";
```

Then add this function above `pageList`:

```ts
/**
 * The starting points, offered wherever somebody might begin a page.
 *
 * Rendered in two places rather than one. `pageList` returns nothing when there
 * are no saved pages, which is right, and which would otherwise hide this from
 * the person who has just arrived and needs it most.
 *
 * A folded `details` with a fixed id, so `shell.ts` reopens it after a repaint
 * along with every other group, and so the picker does not need a scrap of
 * state in the store.
 *
 * Choosing one goes through `openBackup`, the same path the example and a file
 * import take. That is where the page gets validated, gets an id of its own,
 * and is guaranteed not to touch whatever was already open.
 */
function starterPicker(id: string): HTMLElement {
  return disclosure({
    id,
    className: "starters",
    summary: "Start from a template",
    children: [
      el(
        "ul",
        { "aria-label": "Templates to start from" },
        STARTERS.map((starter) =>
          el("li", {}, [
            button({
              // The description is part of the name, not decoration beside it.
              // "Art commissions" and "Handmade and crafts" are a choice only
              // once you know which one covers what you sell.
              label: `${starter.label}. ${starter.description}`,
              onClick: () => {
                void starter
                  .load()
                  .then((doc) => openBackup(serializeDocument(doc)))
                  .catch(() => ({
                    ok: false,
                    message: "That template could not be opened. Nothing has been changed.",
                  }))
                  .then((result) => {
                    announce(
                      result.ok
                        ? `Started a new page from ${starter.label}. Change anything you like.`
                        : result.message,
                    );
                  });
              },
            }),
          ]),
        ),
      ),
    ],
  });
}
```

The `catch` covers two real failures and is not defensive padding. `load()`
fetches a chunk over the network, so a first-time visitor who is offline gets a
rejected promise; and `serializeDocument` throws rather than returning a result
when handed a document that does not validate. Task 1's gate means the second
cannot happen to a shipped starting point, and the message is honest if it ever
does.

The two ids must differ, because two `details` with the same id would break the
open-group restore in `shell.ts:172`, which looks elements up by id.

- [ ] **Step 4: Render it in both places**

In `pageList`, replace the `adders` div near line 235 so the picker sits after
the existing button. The existing button is not touched:

```ts
        el("div", { class: "adders" }, [
          button({
            label: "Start a new page",
            variant: "primary",
            onClick: () => {
              void newPage(getState().doc.target).then(() => {
                announce("Started a new page");
              });
            },
          }),
        ]),
        starterPicker("starters-group"),
```

In `emptyState`, replace the returned array so the picker sits beside the
example. The example button and its label are untouched, because
`scripts/contrast.mjs:123` finds it by matching `/example page/i` and renaming
it would break the colour contrast gate:

```ts
  return [
    el("p", { class: "empty" }, [
      "Your page is empty. Add a section below to start, or begin from a template.",
    ]),
    el("div", { class: "adders" }, [load]),
    starterPicker("starters-group-empty"),
  ];
```

- [ ] **Step 5: Style the list**

Add to `app/src/styles.css`, using the Edit tool and never `cat >>`, which has
destroyed this exact file before:

```css
/* The starting points. A plain list of full-width buttons, so it reads the
   same at eight entries as it will at twenty, and so a thumb has a target
   rather than a line of text. */
.starters ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.starters li button {
  width: 100%;
  text-align: left;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run from PowerShell:

```
npx vitest run app/tests/starters-picker.test.ts
```

Expected: PASS, all five cases.

- [ ] **Step 7: Run the full gate**

Run from PowerShell, as one command, because `verify` chains the steps itself:

```
npm run verify
```

Expected: every step passes. Pay attention to two of them.

`npm run a11y` will fail if the new buttons have no accessible name or if the
touch target minimum is missed. The `button` helper gives every button its
label, and the CSS above gives full width, so both should hold.

`npm run contrast` builds the app and drives headless Chrome. It will fail
loudly, not silently, if the example button was renamed: it refuses to report a
pass unless at least three sections and three fields were on screen.

If a step fails, fix the cause. Never `--no-verify`.

- [ ] **Step 8: Commit**

```bash
git add app/src/ui/build.ts app/src/styles.css app/tests/starters-picker.test.ts
git commit -m "feat(starters): offer the templates where a page is actually started"
```

---

### Task 3: The remaining seven starting points

Content, gated automatically by the test written in Task 1. No code changes at
all, which is the promise in FR-053b being collected.

**Files:**
- Create: `app/src/starters/3d-printed-goods.meta.ts` and `.json`
- Create: `app/src/starters/digital-downloads.meta.ts` and `.json`
- Create: `app/src/starters/dropshipping-store.meta.ts` and `.json`
- Create: `app/src/starters/food-and-bakes.meta.ts` and `.json`
- Create: `app/src/starters/freelance-services.meta.ts` and `.json`
- Create: `app/src/starters/handmade-and-crafts.meta.ts` and `.json`
- Create: `app/src/starters/portfolio-and-about-me.meta.ts` and `.json`

**Interfaces:**
- Consumes: nothing. These are data files.
- Produces: seven more entries in `STARTERS`, found by the glob without any
  registration.

**The honesty rule, restated because it is the whole point of this task.**
Identity fields carry instructions, structure fields carry realistic content:

- **Instructions**, because publishing them unchanged would be a lie about the
  person: document `title` where it names a business, `profile.displayName`,
  `profile.tagline`, link labels and URLs, `avatarUrl`.
- **Realistic**, because publishing them unchanged is harmless and they are what
  teaches the block model: tier `name`, `price`, `unit`, `blurb`, `includes`,
  `details`, section `heading`, and prose body text.

Every URL must be under `example.com`. `isSafeUrl` in the engine decides what
compiles, and a real third-party address in shipped content is both a link we do
not control and a diagnostic waiting to happen.

- [ ] **Step 1: Write the seven descriptions**

Each `.meta.ts` is exactly this shape, with the label and description from the
table in the spec:

```ts
export const meta = {
  label: "3D printed goods",
  description: "Sizes, materials, colours, and turnaround",
};
```

The other six:

```ts
export const meta = { label: "Digital downloads", description: "Presets, brushes, fonts, and templates" };
export const meta = { label: "Dropshipping store", description: "Many items, bulk pricing, and supplier links" };
export const meta = { label: "Food and bakes", description: "Per item and per dozen pricing" };
export const meta = { label: "Freelance services", description: "Hourly and per project, no physical goods" };
export const meta = { label: "Handmade and crafts", description: "One off and made to order pieces" };
export const meta = { label: "Portfolio and about me", description: "A showcase, with no prices at all" };
```

- [ ] **Step 2: Write the seven documents**

Each is a `Document` with `"schemaVersion": 2`, `"target": "rentry"`, and at
least three blocks.

These seven are specified by constraint plus two worked examples rather than
transcribed in full, and that is a deliberate call rather than an omission. They
are content, not logic: the thing that has to be got right is the honesty rule,
the set of fields each trade exercises, and the gate that judges the result, and
all three are stated exactly. Transcribing seven hundred lines of placeholder
copy into a plan would be writing the deliverable twice, and the copy is the one
part a person should write with their own judgement.

`app/src/starters/art-commissions.json` from Task 1 is the first worked example.
`dropshipping-store` is given in full below because it is the least like the
others and because feature F2 will use it as its fixture, so its shape is not
a free choice.

Create `app/src/starters/dropshipping-store.json`:

```json
{
  "schemaVersion": 2,
  "target": "rentry",
  "title": "Store",
  "blocks": [
    {
      "id": "profile",
      "kind": "profile",
      "displayName": "Your store name",
      "tagline": "What you sell, in one line",
      "status": "open",
      "links": [
        { "label": "Your storefront", "url": "https://example.com/your-store" }
      ],
      "paymentMethods": ["PayPal", "Card"]
    },
    {
      "id": "stock",
      "kind": "menu",
      "heading": "In stock",
      "currency": "USD",
      "tiers": [
        { "name": "Phone stand", "price": "12.99", "unit": "each" },
        { "name": "Cable organiser, 5 pack", "price": "9.99", "unit": "each" },
        { "name": "LED strip, 2m", "price": "16.99", "unit": "each" },
        { "name": "Keyring light", "price": "6.99", "unit": "each" },
        { "name": "Desk mat", "price": "24.99", "unit": "each" },
        { "name": "Laptop stand", "price": "29.99", "unit": "each" },
        { "name": "Screen cleaner kit", "price": "8.99", "unit": "each" },
        { "name": "Cable, 1m", "price": "7.99", "unit": "each" },
        { "name": "Wall hook, 4 pack", "price": "10.99", "unit": "each" },
        { "name": "Travel pouch", "price": "14.99", "unit": "each" }
      ]
    },
    {
      "id": "shipping",
      "kind": "prose",
      "heading": "Shipping",
      "text": "Orders go out within two working days. Delivery is usually one to two weeks. Replace this with your own times, and be honest about them: a late parcel nobody warned you about is the complaint you will get."
    },
    {
      "id": "returns",
      "kind": "prose",
      "heading": "Returns",
      "text": "Say here what you accept back and how long somebody has to ask."
    },
    { "id": "rule", "kind": "divider" },
    {
      "id": "how-to-order",
      "kind": "prose",
      "heading": "How to order",
      "text": "Message me with what you want and where it is going, and I will confirm the total before you pay."
    }
  ]
}
```

Ten tiers, plain numeric prices, `unit` on every row, and no `quantities`,
`details` or `imageUrls`. That is what makes it F2's fixture: a menu long enough
that selecting a subset is a real question, and prices uniform enough that
arithmetic over them has a clean case to work on before the awkward ones are
added.

The remaining six follow `art-commissions.json` for shape.

Each should exercise the fields its trade actually needs, so that the starting
point teaches something rather than being the same page with different words:

- **3d-printed-goods**: `menu` tiers using `details` for material and layer
  height, `unit` of "each", and a `gallery` with `layout: "grid"`.
- **digital-downloads**: `menu` tiers with `includes` listing file formats, and
  a `prose` block on licence terms. No shipping anywhere.
- **food-and-bakes**: `menu` tiers using `quantities` for per dozen pricing,
  which is the field feature 017 added and which nothing currently demonstrates.
- **freelance-services**: `menu` tiers with `unit` of "per hour" and "per
  project", and a `prose` block on what a project includes.
- **handmade-and-crafts**: `menu` tiers with `imageUrls`, plus a `gallery` with
  `layout: "list"`.
- **portfolio-and-about-me**: `profile`, `gallery`, and `prose` only. No `menu`
  block at all. This one proves the tool is not only a shop, which is why the
  spec includes it.

- [ ] **Step 3: Run the gate**

Run from PowerShell:

```
npx vitest run app/tests/starters.test.ts
```

Expected: PASS. The test globs, so all eight are now checked with no edit to it.

If "compiles with no diagnostics on any host" fails, read which starting point
and which host. The likely cause is a `gallery` layout or a `menu` shape that
rentry or text.is degrades. Change the document, not the test.

- [ ] **Step 4: Check the picker still reads well at eight**

Run from PowerShell:

```
npx vitest run app/tests/starters-picker.test.ts
npm run a11y
```

Expected: both pass. Every entry must still have a distinct accessible name,
which it will, because the name is the label plus the description and no two
labels repeat.

- [ ] **Step 5: Confirm the bundle did not swallow them**

Run from PowerShell:

```
npm run build:app
```

Expected: eight separate starter chunks listed beside `index-<hash>.js`, and the
entry chunk's gzipped size still close to the 20.0 kB it measured before this
feature. If the entry chunk has grown by tens of kilobytes, the lazy glob has
stopped splitting and the documents are being shipped to everybody.

- [ ] **Step 6: Commit**

```bash
git add app/src/starters
git commit -m "feat(starters): seven more trades, none of which needed a code change"
```

---

### Task 4: Bring the shipped example under the same gate

The spec's closing claim, and a real gap today. `app/tests/example.test.ts`
mocks `fetch` with a two-block fixture defined inside the test file, so nothing
anywhere asserts that the `app/public/example.json` actually shipped is valid,
let alone that it compiles clean on rentry.

This is deliberately its own task, because it can fail. If the shipped example
turns out to emit a diagnostic, that is a finding about the example, and a
reviewer should be able to reject the fix for it without rejecting the eight
starting points.

**Files:**
- Modify: `app/tests/starters.test.ts`

**Interfaces:**
- Consumes: `TARGETS`, `compile`, `parseDocument` from `@mdsb/engine`.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Add to `app/tests/starters.test.ts`. Note `parseDocument`, not
`validateDocument`, because this reads the file as text exactly as the browser
does, so a malformed byte is caught rather than parsed away by the test.

Add `readFileSync` to the existing `node:fs` import at the top of the file.

```ts
describe("the example page that ships", () => {
  // `example.test.ts` mocks fetch with a fixture of its own, so until now
  // nothing read the file that is actually served. It is the first page a
  // visitor sees and it was the one page nothing checked.
  const text = readFileSync(
    fileURLToPath(new URL("../public/example.json", import.meta.url)),
    "utf8",
  );

  it("is a valid page", () => {
    const result = parseDocument(text);
    expect(result.ok ? [] : result.issues.map((i) => `${i.path}: ${i.message}`))
      .toEqual([]);
  });

  it("compiles with no diagnostics on any host", () => {
    const result = parseDocument(text);
    if (!result.ok) throw new Error("the example did not parse, see the test above");

    for (const target of TARGETS) {
      expect(
        compile(result.document, target).diagnostics.map((d) => `${target.id}: ${d.message}`),
      ).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run the test**

Run from PowerShell:

```
npx vitest run app/tests/starters.test.ts
```

Expected: PASS, both cases.

**This is known, not hoped for.** The file was compiled against all three
targets on 2026-09-02 while this plan was being written, and produced an empty
diagnostics list. So this task adds coverage and is expected to find nothing.

Say so in the commit message rather than staying quiet about it. A gate that was
added and caught nothing is still worth having, and recording that it caught
nothing stops the next person assuming it did.

If it does fail, something changed between this plan and the implementation.
Continue to step 3.

- [ ] **Step 3: Only if it failed, fix the example, not the test**

Edit `app/public/example.json` until it compiles clean on all three targets.
Then re-run both this test and the existing example test, which asserts things
about the file's behaviour that must not regress:

```
npx vitest run app/tests/starters.test.ts app/tests/example.test.ts
```

- [ ] **Step 4: Run the full gate**

Run from PowerShell:

```
npm run verify
```

Expected: every step passes.

- [ ] **Step 5: Commit**

```bash
git add app/tests/starters.test.ts app/public/example.json
git commit -m "test(example): check the page that ships, not a fixture beside it"
```

---

### Task 5: Update the record

This project's specs index is load-bearing and its own README says a document
describing an intention as though it shipped is worse than no document. Three
defects here were caused by exactly that.

**Files:**
- Modify: `specs/README.md`
- Modify: `docs/ROADMAP.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Update the specs index**

In `specs/README.md`, change the 021 row's "Shipped" column from `not yet` to
the date it landed. Leave the plan column honest: this feature has a plan, so
that column becomes `yes`, which will make it the first since 002.

- [ ] **Step 2: Note the feature on the roadmap**

`docs/ROADMAP.md` claims every item on it is complete and already carries a
recorded gap, that the Android build is not on it. Add starting points in the
same honest register: what shipped, and that it is the first of four features
the 2026-09-02 ideas decomposed into, with F2, F3 and F4 not started.

- [ ] **Step 3: Verify the dash rule and commit**

Run from PowerShell:

```
node scripts/dash-scan.mjs
```

Expected: clean.

```bash
git add specs/README.md docs/ROADMAP.md
git commit -m "docs: record starting points, and what it is the first quarter of"
```

---

## After this plan

F2, selection and bulk apply, is the next feature and it needs its own spec
before any of it is built. The reasons are already written down in
`specs/021-starting-points/spec.md` under "What this is part of", with the
file and line evidence: menu tiers have no id and are addressed by array index,
undo covers removals only and is cleared by every edit, `cost` must never reach
the compiler, and prices are free text on purpose so arithmetic over them must
skip what it cannot parse.

The `dropshipping-store` starting point built in Task 3 is deliberately the
shape F2 will operate on, so it doubles as that feature's test fixture.
