# Research: The Setup Wizard

**Feature**: 027 | **Date**: 2026-09-08

Five questions the plan could not be written without. Four are decided here. One
changes a requirement in the spec, and that amendment is recorded rather than
quietly applied.

---

## R1: What kind of surface is the wizard?

**Decision**: A surface layered over the editor, built the way feature 025 built
the pages drawer.

**Rationale**: 025 answered this exact question three weeks of work ago and paid
for the answer. The findings it recorded are all binding here:

- It is a `div` with `role="dialog"`, **not an `aside`**. `aria-allowed-role`
  fails an `aside` carrying that role, and the a11y gate catches it.
- jsdom has no `showModal` and no `inert`, neither the property nor the
  behaviour, so a native `<dialog>` cannot be tested at the level everything
  else here is tested at. `inert` is set on the header and main by attribute
  instead.
- `div[tabindex="-1"]` does hold focus under jsdom, which is what makes the
  focus trap testable.
- The device back gesture dismisses the layer before it touches the surface
  underneath. `surface-history.ts` already has the shape for this.

**Alternatives considered**:

- **A fourth tab beside Build, Preview and Copy.** Rejected: the tab bar is
  permanent and this flow is used once. It would cost every returning seller a
  quarter of their tab bar forever to help somebody on their first day.
- **Inline in the Build surface, replacing the empty state.** Rejected: it makes
  "walk away without creating anything" hard, because there is no layer to
  dismiss, and FR-125 is not negotiable.

---

## R2: How does an example get into an empty field?

**Decision**: Through the `hint` the field primitive already takes. **No new
mechanism, and no `placeholder` attribute anywhere.**

**This contradicts the spec as written and FR-129 is amended below.**

**Rationale**: The spec said "a greyed example of a real value in each empty
field" and described what it was avoiding as "a placeholder standing in for a
label". The a11y gate's rule turns out to be stricter than that, and it is
stricter on purpose:

```js
it("does not use a placeholder in place of a label", () => {
  for (const control of document.querySelectorAll("input, textarea")) {
    expect(control.getAttribute("placeholder")).toBeNull();
  }
});
```

That fails on **any** placeholder, not only one doing a label's job. The reason
is in `dom.ts` beside the field primitive: placeholders disappear on focus, are
invisible to some assistive technology, and fail anyone who looks away mid
sentence. A wizard built to help people who cannot work out what to type is the
worst possible feature to weaken that rule for.

Then the audit that decided it. `app/src/ui/forms.ts` has 49 label sites and 13
hints. **Price has an example and Item does not**, so the very first field
anybody meets on a price row is blank with a bare word over it, while the field
next to it says `Anything you like: "45", "from 45", or "DM me"`. That hint is
the thing this user story is asking for, it already exists, it already works, and
it is missing from about three quarters of the fields in the app.

So this is the seventh instance of the pattern this project keeps meeting: the
mechanism exists and the coverage does not. **User Story 2 needs no new code at
all.** It needs hint text on the fields that lack it and a test that says every
field has one.

**Alternatives considered**:

- **The `placeholder` attribute.** Rejected: it fails a gate that is verified to
  fire, and the gate is right.
- **A decorative example rendered inside the input's box, `aria-hidden`, removed
  once the field has a value.** A real option, and the honest argument for it is
  that the eye goes to the empty box rather than to the text above it. Rejected
  for now on cost: it is a new mechanism in the most heavily tested primitive in
  the app, it has to vanish on the first keystroke without ever eating one, and
  it would sit alongside the hint rather than replacing it. If somebody watches a
  seller ignore the hints, this is the next thing to try, and it is a separable
  change.

---

## R3: How does the wizard turn answers into a page?

**Decision**: Build a `Document` in memory, serialize it, and hand it to
`openBackup`, which is the exact path `starterPicker` uses today.

**Rationale**: FR-123, and Principle V behind it. That path already opens the
result as a NEW page and leaves whatever was open untouched, which is the whole
of the "never destroy work in progress" requirement, already written and already
tested. Writing answers into the live document instead would mean the wizard
edits the page somebody is already on, and abandoning halfway would leave
wreckage.

It also inherits the failure handling. `starterPicker` already covers the cold
lazy chunk with `setBusy`, and catches an offline `load()` with a message that
changes nothing.

**Alternatives considered**: writing each answer to the store as it is given, so
the page grows behind the wizard. Rejected: it makes FR-125 impossible without
an undo of everything, and this project has one undo slot, not a stack.

---

## R4: How does an answer choose a starting point?

**Decision**: A mapping in the app from the "what do you sell" answer to one of
the eight starter ids, plus an explicit "something else" answer that maps to a
reasonable default.

**Rationale**: FR-122 forbids the wizard inventing a ninth page of content, and
the eight were chosen for exactly this question in feature 021. The mapping is
data in the app, not logic in the engine, and it is one line per answer.

The eight, with what they say they are for:

| Starter | For |
|---|---|
| 3D printed goods | Sizes, materials, colours, and turnaround |
| Art commissions | Tiers, slots, terms, and examples |
| Digital downloads | Presets, brushes, fonts, and templates |
| Dropshipping store | Many items, bulk pricing, and supplier links |
| Food and bakes | Per item and per dozen pricing |
| Freelance services | Hourly and per project, no physical goods |
| Handmade and crafts | One off and made to order pieces |
| Portfolio and about me | A showcase, with no prices at all |

**Alternatives considered**: inferring the starter from several answers at once
rather than one. Rejected as guessing: a rule that picks "Handmade and crafts"
because somebody said made to order, when they said they sell digital downloads,
is worse than asking one clear question.

---

## R5: Where does the store name go?

**Decision**: `profile.displayName` on the page's About you section, never
`document.title` alone.

**Rationale**: FR-121, and the trap recorded in the spec. `title` is a document
field the compiler never emits, and the editor labels it "Only you see this".
Seven of the eight starters open with a profile block, so the field is already
there to write into. Setting `title` as well is fine and useful, because it is
how the page is listed in the sidebar, but it is not the answer on its own.

---

## R6: What the gates need

**Decision**: Extend `app/tests/a11y.test.ts` with the wizard on screen at every
question, and extend `scripts/contrast.mjs` to open the wizard.

**Rationale**: The contrast gate has now been caught twice measuring a surface
it never laid out. Feature 025 moved the page list into a drawer and the gate
silently went from 164 elements to 137. Feature 026 found it had never opened a
price row's fold at all: 3 fields and zero `details` under `#surface`, so about a
dozen controls were unmeasured, and it went to 404 elements once fixed.

Both times nothing failed, because **a gate that measures less does not complain
about it**. A new surface with its own questions, buttons and helper text is
precisely the shape of thing that goes unmeasured, so the gate gets a counted
guard for the wizard the same way it now has one for `folded` and `pages`.

---

## Amendment to the specification

**FR-129 as written says "MUST show one" of an example in the empty field, and
the word to read there is now "example", not "in the field".**

Replace the intent as follows, recorded here rather than edited invisibly:

> **FR-129 (amended)**: Every text field in the editor that has an obvious
> example MUST show one in its hint, and the hint MUST NOT be part of the saved
> page or the compiled output.
>
> **FR-130 (unchanged in effect, stronger in wording)**: No field may carry a
> `placeholder` attribute. Every field keeps its own `<label>`, and the example
> is additional to the label rather than a substitute for it.

The user visible promise is unchanged: somebody meeting an empty field can see
what belongs in it. What changed is the discovery that the mechanism already
exists and that the alternative is banned by a gate this project verified was
firing. `specs/012-page-lifecycle/spec.md` amended `011` in its own document for
the same reason: a specification that quietly changes to match the code is worth
nothing.
