# Implementation Plan: The menu file

**Branch**: `024-menu-file` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/024-menu-file/spec.md`

## Summary

A seller can save their page as one self contained HTML file and send it to
somebody, and can use pictures from their own device in it. Those pictures are
locked to that file and can never reach a paste host.

The lock is not a warning. The saved file becomes a **target record** like
rentry and text.is, carrying one new capability, `localImages`, that every paste
host has as `false`. The emitters then read a flag exactly as they already read
`tables`, and the boundary is a data value rather than a special case in code or
a label somebody has to notice. A seller who adds a picture and selects rentry
sees it absent from the output and sees a warning saying where it does appear,
because Principle VII already makes the preview show compiled output.

Local pictures travel through compiled markdown as `mdsb-asset:<id>`, never as
bytes. The app swaps them for real image data on the rendered DOM, after the
markdown has become elements and before the file is serialized. See research D3
for why, and note it reverses the approved plan document.

Also in scope, and much smaller: relabelling the quantity breakdown control,
which produces the layout that prompted this feature and which nobody can find.

## Technical Context

**Language/Version**: TypeScript 5.4, strict, ES2022 target. `findLastIndex` does
not typecheck here and the floor is not being raised to get it.
**Primary Dependencies**: None at runtime. `engine/` has zero by constitution;
`app/` depends only on `@mdsb/engine`. Vite 7, Vitest 3, ESLint 9 in dev.
Capacitor 8 wraps the Android build.
**Storage**: IndexedDB. `pages` today, `assets` added by this feature.
**Testing**: Vitest, jsdom, `fake-indexeddb` pinned at 6.2.5, axe-core under
jsdom for a11y, headless Chrome for contrast and the service worker update gate.
**Target Platform**: Mobile first browser PWA, plus an Android package built
with Capacitor. The owner uses the Android one, so that is where this is proved.
**Project Type**: npm workspaces monorepo, pure compiler plus vanilla TS app.
**Performance Goals**: Typing must not stutter on a Moto G7. The split preview
is decided in JS rather than CSS specifically so a phone never builds the second
DOM. Nothing here may regress that.
**Constraints**: Offline capable. Fully functional with no network. No account,
no server, no secret in the bundle. text.is states a 200000 byte page limit,
which is the arithmetic behind the whole feature.
**Scale/Scope**: One seller, their own pages, on their own device.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | How this plan satisfies it |
|---|---|---|
| I | The Engine Is a Pure Function | The engine gains one boolean capability and one emitted string form, `mdsb-asset:<id>`, built from a value already in the document. No DOM, no fetch, no clock, no randomness: asset ids are minted in the app by `newId()` and only ever read by the engine. The version 3 to 4 migration creates nothing, so it invents no ids and stays deterministic, which is the same reason the version 2 to 3 step numbers rows positionally rather than randomly. Byte resolution happens entirely in `app/`. ESLint enforces this over `engine/src/**` and is verified to fire. |
| II | Hosts Are Data, Never Code | The saved file is added as a target record, not a branch. No emitter learns which host it is compiling for; it asks `capabilities.localImages`. The new capability declares its fallback, which is FR-080: drop the picture, raise `local_image_unsupported` naming it. `capabilities.ts` demands a consumer and a fallback test before a capability may exist, and both arrive with it. Adding this host touches `targets.ts`, `capabilities.ts`, goldens and tests. It touches `emit/` only to consume the new flag, which is the sanctioned direction. |
| III | Test-First, With Golden Files | Failing test first throughout. The three structurally required tests all move: parity regenerated and its diff read, round trip extended to the new fields, determinism unchanged and re-run. A golden fixture set is added for `MENU_FILE`, and any emitter change shows its golden diff in the commit. A version 3 fixture covers the new migration step, per the rule that every step gets one. |
| IV | The Narrow Gate | Nothing is ever assigned to `innerHTML`; the file is produced by serializing a tree built with `createElement` and `textContent`, so text is escaped on the way out rather than trusted on the way in. The XSS corpus grows to cover the new sink, which is what this principle requires for any new user authored path, and SC-003 checks the produced files rather than the code that produces them. `data:` is admitted to neither address check: bytes never pass through them. Stored picture types are an allow list of four raster formats, and SVG is refused. No secret enters the bundle and the secret scan still runs. |
| V | The User's Work Is Sacred | `schemaVersion` goes to 4, forward only, with a fixture. A newer page is still refused unread and its exact bytes still offered back under FR-018; `pages` is not touched. Nothing deletes a picture automatically, for any reason including reclaiming space, which is why D6 defers collection rather than being clever. Storage exhaustion gets a specific message naming what is in use and what to do, replacing the raw DOMException a quota failure produces today, which this principle defines as a defect. A page whose picture is gone still opens and still exports. |
| VI | Reachable By The People Who Need It | Every new control clears 44 by 44 CSS pixels, carries a real accessible name rather than a plausible looking one, and is keyboard operable. The a11y gate asserts exactly this and is verified to fire by stripping a label. Contrast runs in both palettes because both ship. The saved file is held to the same bar: it is semantic HTML with headings and a real table, alt text is carried through from the compiled output, and it reflows without sideways scrolling at 390px. A picture of a menu would fail this principle, which is why D1 rejected the PNG. |
| VII | Honest Fidelity | The saved file is produced from compiled output through the same renderer the preview uses, so the two cannot drift. The seller can preview the menu file itself, so what they see is what they save. When a paste host is selected, the preview keeps showing that host's compiled output, absent pictures and all, and states the divergence in the interface rather than in a document nobody reads. |

**Result: pass.** One narrowing of an existing stated property is recorded in
Complexity Tracking below rather than left for a reviewer to notice.

## Project Structure

### Documentation (this feature)

```text
specs/024-menu-file/
├── plan.md              # This file
├── spec.md              # Requirements, FR-070 to FR-092
├── research.md          # Phase 0, six decisions, two of them reversals
├── data-model.md        # Phase 1, schema v4 and the asset store
├── quickstart.md        # Phase 1, how to see it working
├── contracts/
│   └── menu-file.md     # Phase 1, what the saved file guarantees
├── checklists/
│   └── requirements.md  # Spec quality validation
└── tasks.md             # Phase 2, /speckit.tasks, not created here
```

### Source code

```text
engine/src/
├── document/
│   ├── descriptor.ts        # SCHEMA_VERSION 4, three new optional fields
│   └── migrate.ts           # v3 to v4, sets the stamp and nothing else
└── compile/
    ├── capabilities.ts      # localImages, and its citation on every target
    ├── targets.ts           # MENU_FILE, deliberately outside the TARGETS array
    ├── diagnostics.ts       # local_image_unsupported
    └── emit/
        ├── menu.ts          # tier pictures
        ├── gallery.ts       # item pictures
        └── profile.ts       # avatar

engine/tests/
├── document/
│   ├── parity.snapshot.json # regenerated, diff read
│   └── fixtures/v3-*.json   # the new migration step's fixture
└── compile/
    ├── local-image-never-published.test.ts   # the sentinel
    └── goldens/                              # a MENU_FILE set

app/src/
├── db.ts                    # DB_VERSION 2, the assets store
├── assets.ts                # NEW: store, read, total, remove, quota
├── menu-file.ts             # NEW: compile, render, embed, serialize
├── files.ts                 # unchanged unless the bridge measurement says otherwise
├── upload.ts                # normalise() reused, not copied
└── ui/
    ├── export.ts            # the save control and the size report
    ├── image-field.ts       # "Add from this device"
    ├── render-markdown.ts   # narrow mdsb-asset allowance
    ├── forms.ts             # the Bulk pricing relabel
    └── storage.ts           # NEW: what pictures cost, and removing them

android/app/src/main/java/.../MainActivity.java   # only if the measurement demands it
```

**Structure Decision**: The existing npm workspaces layout is kept exactly. The
direction of dependency stays app to engine and never the reverse. The two new
app modules, `assets.ts` and `menu-file.ts`, are separate because one owns bytes
and the other owns presentation, and the seam between them is the thing the
holistic review is most likely to find a bug in.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `render-markdown.ts` states "there is no path from artist text to markup at all", and this feature produces a markup string from that renderer's output. The property is narrowed from "no markup string exists" to "no markup string is ever parsed back in". | The saved file must be markup, and reusing the preview renderer is what makes Principle VII's no-drift guarantee free. A second renderer would be two renderers to keep in step, which is the exact bug class this repository keeps paying for. | Writing a separate emitter for the export was recommended by an exploration agent and is the honest alternative. It is rejected on the reasoning above, but the reasoning is an argument and not evidence, so SC-003 settles it by running the hostile text corpus through the produced files. If that fails, this row becomes wrong and the separate emitter is built. |
| A new IndexedDB object store holding Blobs, in an app whose persistence layer is 111 lines and assumes a page is a few kilobytes of text. | Pictures on the device cannot be held anywhere else, and the feature is the owner's stated priority. | Keeping pictures as remote addresses only, which is the status quo, does not answer the request: a menu file whose pictures live on somebody else's server is not an offline menu. |
| Quota accounting, a persistence request and a storage view, none of which the app has today. | Principle V makes a generic failure message a defect, and this feature is what makes storage exhaustion reachable in practice. | Letting a quota failure fall into the existing generic catch, which is what happens today, is precisely what the principle forbids. It is not a smaller option, it is the defect. |
