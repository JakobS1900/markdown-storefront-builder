# Research: The pages sidebar

**Feature**: 025-pages-sidebar
**Date**: 2026-09-07

Four decisions. The first was settled by a probe that came back the opposite of
what was hoped, and it changes the design.

---

## D1: Not a native `<dialog>`, because jsdom cannot test one

**Decision**: Build the drawer as an ordinary element with explicit focus
management, rather than on `<dialog>` and `showModal()`.

**This is the reverse of the obvious answer**, and the obvious answer was tried
first. `<dialog>` with `showModal()` gives a focus trap, escape to close, an
inert background and top layer rendering for nothing, which is FR-099 and
FR-100 satisfied by the platform. The project's own minimalism rule says to
reach for a native feature before writing one.

**A throwaway probe under this repository's own test environment settled it:**

```
DIALOG PROBE {"showModal":false,"close":false,"openProp":true,
              "modalWorks":false,"error":"d.showModal is not a function"}
```

jsdom implements the `open` property and neither method. Every user interface
test in this project runs under jsdom, so building on `showModal` means stubbing
the exact mechanism under test and asserting against the stub. This project has
already recorded what that produces: twenty one tests covered a paste panel and
every one missed that it displayed nothing, because they all set a value without
focusing anything.

**Alternatives considered**:

- **`<dialog>` plus a stub in tests.** Rejected above.
- **`<dialog>` driven by the `open` attribute rather than `showModal`.** Works
  in jsdom, but the top layer, the backdrop and the focus trap all come from
  `showModal` specifically. This is the custom build wearing a `dialog` tag, and
  the tag would imply guarantees it no longer provides.
- **`<dialog>` plus a real browser gate**, in the manner of `contrast.mjs` and
  `menu-file.mjs`. Genuinely tempting and kept on the table for later: those
  gates exist and they found things jsdom structurally cannot see. Rejected for
  now because it makes a drawer depend on a headless Chrome run to be tested at
  all, which is a heavy bill for one panel.

**What this costs**, stated plainly: focus containment, escape handling and
making the background unreachable are now ours to write and ours to get wrong.
Each becomes a requirement with a test rather than a platform guarantee.

---

## D2: Nothing that contains the tab bar may be transformed

**Decision**: The drawer is a sibling of the tab bar, and only the drawer itself
is transformed. `#app` and every ancestor of `.tabs` stay untransformed.

**Rationale**: This project has already shipped this bug. A `transform` on `#app`
makes it the containing block for every `position: fixed` descendant, so `.tabs`
pinned itself to the app rather than the viewport. The handoff records the sharp
edge of it as well: `transform: none` in a `to` keyframe does NOT avoid it,
because animated it computes to the identity matrix rather than the keyword, and
a `both` fill persists that forever.

The obvious drawer implementation slides the whole shell sideways, which is
exactly the forbidden shape. Sliding only the panel is equivalent to look at and
touches nothing that contains a fixed element.

**Anything added to `#app` later that transforms, filters, or sets
`will-change` will reintroduce this.** That is worth a test rather than a
comment, and the plan has one.

---

## D3: Two containers, one list

**Decision**: One function builds the list of pages. A narrow screen puts it in
an overlay panel; a wide screen puts it in a plain column beside the editor.
The choice is made in JavaScript, not in CSS.

**Rationale**: This is exactly what the shell already does for the preview pane,
and for a stated reason worth repeating: hiding a pane with a media query still
compiles the document and builds its DOM on every repaint, on the phone, for
something the phone cannot show, and that is the work that made typing expensive
on a Moto G7. `roomForBoth()` and `watchWidth()` already exist for this and are
reused rather than copied.

The overlay is built only when it is open. A drawer nobody has opened should
cost nothing per keystroke, which is what SC-014 is there to check.

---

## D4: Open state lives in the store, not in the DOM

**Decision**: `sidebarOpen` on application state.

**Rationale**: The shell rebuilds its entire interface on every repaint, so any
state held only in a DOM node is destroyed the next time anything changes. The
existing code already works around this for `<details>` groups by capturing and
restoring them around a render, which is a reasonable trick for something
incidental and the wrong one for a panel that is the current focus of the
seller's attention.

Putting it in state also makes the back gesture straightforward: closing is a
state change like any other, and `surface-history.ts` already exists to give the
system back button somewhere to return to.

---

## Open, to be answered by measurement

- **Whether the pinned sidebar costs anything per keystroke on the reference
  handset.** It is built on every repaint above 900 pixels, and the split view
  is already doing the same thing for the preview. Measured against SC-014
  rather than assumed, on the Moto G7 the rest of this project's layout
  decisions were measured on.
