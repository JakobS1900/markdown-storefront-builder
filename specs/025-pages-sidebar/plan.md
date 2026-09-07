# Implementation Plan: The pages sidebar

**Branch**: `025-pages-sidebar` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/025-pages-sidebar/spec.md`

## Summary

Move the list of saved pages out of the Build surface and into one place reachable
from all three surfaces: a drawer over the page on a phone, a column beside the
editor above 900 pixels. Starting a page, starting from a template and removing a
page move with it, so there is one place those things happen rather than two.

Two constraints shape the whole thing, and both come from mistakes this project
has already made. jsdom implements no `showModal`, so the drawer cannot be a
native modal without becoming untestable (research D1). And nothing containing
the tab bar may be transformed, because a transform on the app root once
re-parented every fixed element inside it (research D2).

## Technical Context

**Language/Version**: TypeScript 5.4, strict, ES2022.
**Primary Dependencies**: None at runtime. Vanilla DOM through the existing
`el()` builder; no framework, no focus-trap library.
**Storage**: Unchanged. This feature reads `state.pages`, which is already
gathered and refreshed at the moments the set can change.
**Testing**: Vitest under jsdom, axe-core for the accessibility gate, headless
Chrome for contrast. jsdom lays nothing out, so anything about width or overlay
is asserted structurally here and measured in a browser gate.
**Target Platform**: Mobile first PWA plus the Capacitor Android build. The
reference handset is a Moto G7 at 390 by 844.
**Project Type**: npm workspaces monorepo, pure engine plus vanilla TS app.
**Performance Goals**: Typing must not get slower. The split view exists in JS
rather than CSS specifically so a phone never builds what it cannot show, and
this feature follows that rule rather than weakening it.
**Constraints**: Offline capable, no network, no new dependency.
**Scale/Scope**: One seller, a handful of pages, on their own device.

## Constitution Check

| # | Principle | How this plan satisfies it |
|---|---|---|
| I | The Engine Is a Pure Function | The engine is not touched. No file under `engine/src` changes, and nothing here compiles, emits or reads a document. |
| II | Hosts Are Data, Never Code | No target record, no capability, no emitter is involved. |
| III | Test-First, With Golden Files | Failing test first for every behaviour. No golden file changes, because no compiled output changes; if one moves, this plan is wrong. |
| IV | The Narrow Gate | No new user authored content reaches the DOM: page titles already render through the same `el()` and `textContent` path as the existing list, which is the path that has no `innerHTML` in it. No new address, no new sink, so the corpus does not grow. |
| V | The User's Work Is Sacred | Removal keeps its confirmation, keeps naming the page in the question and both answers, and keeps the safe answer prominent. FR-103 adds a protection that does not exist today: the open page cannot be removed from under the editor. Nothing changes about when a page is written. |
| VI | Reachable By The People Who Need It | This is where most of the work is, because D1 gave the platform's guarantees back to us. Focus moves into the panel on open and returns to the control that opened it on close; the background is made unreachable while it is open; escape and the system back gesture both close it; every control clears 44 by 44 and carries a real name. The a11y gate grows to cover the open drawer, which is a state it has never seen. |
| VII | Honest Fidelity | Not applicable to this feature. Nothing here previews or publishes anything. |

**Result: pass**, with the accessibility work called out as the substantial part
rather than the incidental part. See Complexity Tracking.

## Project Structure

### Documentation

```text
specs/025-pages-sidebar/
├── plan.md              # This file
├── spec.md              # FR-093 to FR-107, SC-009 to SC-014
├── research.md          # Four decisions, one of them a reversal
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit.tasks, not created here
```

### Source code

```text
app/src/
├── store.ts             # sidebarOpen, plus its open and close
├── surface-history.ts   # the back gesture closes the drawer first
└── ui/
    ├── shell.ts         # the trigger, and which container the list goes in
    ├── pages-sidebar.ts # NEW: the list, and the drawer around it
    ├── build.ts         # the old list comes OUT of here
    └── ../styles.css    # drawer, backdrop, pinned column

app/tests/
├── pages-sidebar.test.ts   # NEW
├── a11y.test.ts            # the open drawer is a new state to cover
└── split-view.test.ts      # the breakpoint now decides two things
```

**Structure Decision**: One new module, because the list and its container are
one idea and `build.ts` is already the largest file in the interface. Everything
else is an edit to something that exists.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Hand written focus containment, escape handling and background inerting, which the platform provides free through `<dialog>` and `showModal()`. | jsdom implements neither method, proven by probe in research D1, so a native modal cannot be tested by any test in this repository. | Stubbing `showModal` in tests means asserting against the stub. This project has already shipped twenty one tests that covered a panel and all missed that it displayed nothing, because they tested around the mechanism rather than through it. A real browser gate was the other candidate and is recorded as a future option rather than built now. |
| A second place the breakpoint is consulted, alongside the preview pane. | The list must be a drawer on a phone and a column on a desktop, and deciding that in CSS would build the phone's DOM for something the phone never shows. That is the exact cost the split view was moved into JS to avoid. | A CSS only responsive panel is fewer lines and reintroduces per keystroke work on the handset this project measures against. |
| Moving the page list rather than adding a sidebar beside it. | FR-106. Two lists means two places to remove a page from and two behaviours to keep in step. | Leaving the Build list in place is strictly less work in this feature and pays for it forever afterwards. |

## The two traps, in one place

Both are recorded in `docs/HANDOFF.md` and both are the kind that pass review.

**Do not transform anything containing the tab bar.** `.tabs` is
`position: fixed`. A transform on `#app`, or on any ancestor of `.tabs`, makes
that element the containing block and the tab bar pins itself to it. `transform:
none` in a `to` keyframe does not avoid it: animated it computes to the identity
matrix, and a `both` fill persists it. Slide the panel, never the shell. A test
asserts `#app` has no transform.

**Do not build the drawer when it is closed.** It costs a keystroke otherwise,
on a device where a rebuild measured 37ms and two of them per character dropped
input outright.
