# Feature Specification: The Setup Wizard

**Feature Branch**: `027-setup-wizard`
**Created**: 2026-09-08
**Status**: Specified before implementation.
**Input**: F4 of the four features the 2026-09-02 ideas decomposed into, and the
last of them. The decomposition is in `specs/021-starting-points/spec.md` under
"What this is part of". F2 shipped as 021, F3 as 023, and the schema half of
this one was carved out and shipped as 026.

## The problem

**Said by Jakob on 2026-09-05, first hand: somebody used a starting point and
could not figure out what to write. They got overwhelmed.**

That sentence is the whole feature and it is worth reading precisely. The
failure is not that the starting point had the wrong sections in it. Feature 021
put eight of them in and they are good. The failure is that a blank field with a
label over it does not tell somebody what to type, and eight blank fields at
once is worse than one.

So this feature is a way in, not a new capability. It asks a person a few
questions in their own words and hands back a page that already has their
answers in it, instead of handing them a form and hoping.

## The audit that had to come first

This project has now watched the same thing happen five times: somebody asks for
a feature that already exists and nobody could find. The per item price table,
headings, pages being saved, categories, and pasting a price list. One of those
was fixed by renaming a field and changing no behaviour at all (`1e8013b`).

So before specifying a question, the question gets audited: **is the answer a
new feature, or a name?** Every question Jakob listed, checked against the
schema as it stands on 2026-09-08:

| The question, in Jakob's words | Where the answer goes | Already exists |
|---|---|---|
| What do you want to name your store | `profile.displayName` | yes |
| Do you want a header for your store | `heading` block, levels 1 to 6 | yes |
| Do you want a visual for your store | `profile.avatarUrl` or `localAvatarId`, `gallery`, `tier.imageUrls` | yes |
| What kind of store do you have | one of the eight starting points | yes |
| What are you selling | `tier.name` and `tier.price` | yes |
| Selling in any specific quantities | `tier.unit` and `tier.quantities` | yes |
| Something you make from home | `tier.availability` = `made-to-order` | yes, since 026 |
| Something you already have | `tier.availability` = `in-stock` | yes, since 026 |
| Something going to be a preorder | `tier.availability` = `preorder` | yes, since 026 |
| Sold by weight, by quantity, or both | `tier.unit` and `tier.quantities` | yes |

**Every answer already has somewhere to go. This feature adds no schema.** That
is the finding, and it is the sixth instance of the pattern rather than a
coincidence. It also sets a rule for the rest of the work: if a question turns
out to need a field that does not exist, **stop and specify that field
separately**, the way 026 was carved out of this feature rather than grown
inside it.

## The trap the audit caught

`title` on a document is not the store's name. The compiler never emits it, and
the editor labels it "Only you see this. It is how the page is listed when you
come back."

A wizard that asks "what do you want to name your store" and writes the answer
to `title` would produce a page whose name the seller never sees on the page and
nobody they send it to ever reads. It would look right in the editor and be
wrong everywhere else, which is the worst shape a defect can have here. FR-121
exists because of this.

## What this is not allowed to do

**It must never replace or discard a page in progress.** Principle V. The
existing starter path already gets this right and the mechanism is reused rather
than reinvented: `starterPicker` calls `openBackup(serializeDocument(doc))`,
which opens the starter as a NEW page and leaves whatever was open alone.

**It must not delete the starting point picker.** Somebody who knows what they
want keeps their one press path. The picker becomes reachable rather than
primary, and it is not removed.

**No placeholder may stand in for a label.** Constitution VI, and the a11y gate
asserts it and is verified to fire. The examples this feature adds go inside
empty fields as an example of a value; every field keeps its real `<label>`.

**The engine is not touched.** Principle I. This is entirely an app surface over
a schema that already exists.

## Out of scope, deliberately

- **Pasting a whole messy existing page** from rentry or pastebin. Deferred to
  028. Feature 023 already ships paste-guess-confirm for a price list inside a
  Prices section; the remaining gap is splitting a whole page into headings,
  about text and prices, which is a different problem from asking questions.
- **Fewer fields on first sight** across the other section forms. It is a real
  answer to the same complaint and it is not this feature. FR-092 already did it
  for price rows.
- **Any new schema field.** See the audit above.
- **Editing an existing page through the wizard.** It builds a first page. Going
  back through the questions to change a finished page is a different feature and
  a different set of hazards.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Somebody's first page, from questions (Priority: P1)

A person who has never used this opens it and is asked what they sell, what
their store is called, what the first thing they sell is and what it costs, and
how it reaches a buyer. They answer in their own words. They land on a page that
already says those things, with sections around them, and they can see what to
change next because there is real content on screen rather than empty boxes.

**Why this priority**: This is the feature. Without it there is nothing.

**Independent Test**: Answer every question and confirm the resulting page
carries the typed store name where a buyer will read it, and at least one item
with its name and price.

**Acceptance Scenarios**:

1. **Given** an empty app, **When** somebody answers every question, **Then**
   the page that opens carries their store name, their first item and its price,
   and the selling mode they chose.
2. **Given** the wizard is on its first question, **When** somebody answers only
   that one and finishes, **Then** a usable page still opens, built from the
   starting point their answer chose.
3. **Given** somebody chose "made to order", **When** the page opens, **Then**
   the first item carries that mode, and the published output says "Made to
   order" in an Availability column.
4. **Given** a page is already open with work in it, **When** somebody runs the
   wizard, **Then** the new page is created alongside and the existing page is
   unchanged.

---

### User Story 2 - Examples for the empty fields (Priority: P2)

Somebody who skipped the wizard, or who came back a week later to add a second
item, meets an empty field and does not have to guess what belongs in it. An
example of a real value is on screen with the field.

**Amended on 2026-09-08, before any code was written.** This story said "the
field shows an example" and meant text inside the empty box. `research.md` R2
found that the accessibility gate refuses a `placeholder` attribute outright,
not merely one doing a label's job, and it is right to: placeholders vanish on
focus and fail anyone who looks away mid sentence. It also found that the
mechanism already exists and the coverage does not. `app/src/ui/forms.ts` has 49
label sites and 13 hints, and **Price carries an example while Item, right next
to it, carries nothing.**

So the example goes in the field's hint, which is the thing this app already
uses for exactly this and which no gate has to be weakened to allow. The promise
to the person using it is unchanged. Recorded here rather than corrected
silently, because a specification that quietly changes to match the code is
worth nothing, which is the argument `specs/012-page-lifecycle/spec.md` makes
against `011`.

**Why this priority**: It answers the same complaint as the wizard, everywhere
in the app at once, and it keeps working for the people the wizard never
reaches. It is separable from the wizard and shippable on its own.

**Independent Test**: Open any section form with no wizard involved and confirm
every empty field either shows an example or is one where an example would be
meaningless, and that no field lost its label.

**Acceptance Scenarios**:

1. **Given** an empty item row, **When** it is on screen, **Then** the Item and
   Price fields each show an example of a real value.
2. **Given** a field showing an example, **When** somebody types, **Then** what
   they typed is what the field holds, and the example never becomes content.
3. **Given** a field showing an example, **When** the page is saved and
   compiled, **Then** the example is not in the saved page or the output.
4. **Given** any field showing an example, **When** the accessibility gate runs,
   **Then** the field still has its own label, and no field anywhere carries a
   `placeholder` attribute.

---

### User Story 3 - Skipping, and walking away (Priority: P3)

Somebody who knows exactly what they want gets past the questions without
answering them. Somebody who starts answering and changes their mind leaves
without damage.

**Why this priority**: It protects what already ships. The picker and the blank
page are how everybody reaches the app today, and a front door that traps people
is worse than no front door.

**Independent Test**: Reach a blank page and reach the starting point picker,
each without answering a question, and abandon the wizard halfway and confirm
nothing was created and nothing was lost.

**Acceptance Scenarios**:

1. **Given** the wizard's first screen, **When** somebody chooses to skip,
   **Then** they reach the same empty state that ships today, picker included.
2. **Given** the wizard is halfway through, **When** somebody leaves it, **Then**
   no page has been created and any page that was already open is untouched.
3. **Given** the wizard is halfway through, **When** somebody goes back a
   question, **Then** the answer they already gave is still there.

---

### Edge Cases

- Somebody answers nothing at all and finishes. A page still opens, from a
  reasonable default starting point, and it is not empty.
- Somebody types a store name of several hundred characters, or one made
  entirely of Markdown punctuation. It reaches the page escaped, through the
  same path every other authored string uses.
- Somebody's answer to "what do you sell" fits none of the eight starting
  points. There is an answer that means "something else", and it produces a page
  rather than a dead end.
- The starting point fails to load, which is the offline case the existing
  picker already handles. The wizard says so and changes nothing.
- Somebody runs the wizard on a device where a previous page is open and
  unsaved. Nothing is discarded.
- Somebody presses back on the phone mid wizard. That is the surface history
  question feature 025 already answered for the sidebar, and the wizard has to
  answer it the same way rather than a new way.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-119**: The app MUST offer a question by question path to a first page,
  reachable from the empty state.
- **FR-120**: The wizard MUST ask at most seven questions, one idea per screen,
  and every question MUST be skippable.
- **FR-121**: The store name a person types MUST land where a reader of the
  published page will see it, never only in the private page title.
- **FR-122**: The answer to what kind of store somebody has MUST select one of
  the eight existing starting points, and the wizard MUST NOT introduce a ninth
  set of page content of its own.
- **FR-123**: The wizard MUST create its page the same way the starting point
  picker does, as a new page, leaving any page already open unchanged.
- **FR-124**: Answers about how an item reaches a buyer MUST be written to the
  fields feature 026 added, and MUST NOT introduce a parallel way of saying the
  same thing.
- **FR-125**: The wizard MUST be abandonable at any point, and abandoning it
  MUST create nothing and change nothing.
- **FR-126**: Going back a question MUST preserve the answer already given.
- **FR-127**: Finishing with no answers at all MUST still produce a usable page.
- **FR-128**: The starting point picker and the blank page MUST both remain
  reachable without answering a question.
- **FR-129**: Every text field in the editor that has an obvious example MUST
  show one in its hint, and the example MUST NOT be part of the saved page or
  the compiled output. Amended, see User Story 2 and `research.md` R2.
- **FR-130**: No field may carry a `placeholder` attribute. Every field keeps its
  own `<label>`, and the example is additional to the label rather than a
  substitute for it.
- **FR-131**: Everything a person types into the wizard MUST reach the page
  through the same escaping path as every other authored string.
- **FR-132**: The wizard MUST work at 390px with no horizontal scrolling, and
  every control on it MUST meet the 44 by 44 minimum.
- **FR-133**: The device back gesture MUST dismiss the wizard before it leaves
  the surface, consistent with how feature 025 handled the sidebar.

### Key Entities

- **An answer set**: what somebody has said so far, held only while the wizard
  is open. It is not a saved document, it has no schema, and nothing outside the
  wizard reads it. When the wizard finishes it becomes an ordinary page and
  stops existing.
- **A starting point**: the eight that already ship, unchanged. The wizard picks
  one and fills parts of it in.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Somebody who has never seen the app reaches a page carrying their
  own store name and at least one item with a name and a price, without leaving
  the app to look anything up.
- **SC-002**: The path from opening the app to that page is at most seven
  screens, and every one of them can be passed without typing.
- **SC-003**: Somebody who wants to skip the questions reaches the same starting
  point picker that ships today in no more presses than it takes now.
- **SC-004**: No page is ever lost or overwritten by the wizard, under any order
  of answering, skipping and abandoning.
- **SC-005**: Every empty field in the editor either shows an example of a real
  value or is one where an example would mean nothing, and none of those
  examples appears in a saved page or a published one.
- **SC-006**: The accessibility gate passes with the wizard on screen at every
  question, and the contrast gate passes with the wizard measured in both the
  light and dark palettes. Two gates, said separately on purpose: the
  accessibility gate runs without layout and has no palettes, so a single
  sentence covering both would be asking one of them for something it cannot
  give.
- **SC-007**: A page produced by answering nothing is indistinguishable from one
  produced by the starting point picker today.

## Assumptions

- **"Do you want a header for your store" is answered by the store name
  question**, rather than asked separately. A yes or no about a header asks
  somebody to choose between two things they cannot yet picture, and the name
  they type is the header in every case anybody has described. Recorded here
  rather than silently dropped: if this is wrong it is a question to add back,
  and it is cheap to add back.
- **"Do you want a visual" is asked once, about the page, not per item.** Adding
  pictures to individual items is what the editor is for, and the wizard's job
  is to stop somebody stalling on the first screen.
- **The eight starting points are enough to answer "what kind of store".** They
  were chosen for this in feature 021. If somebody's answer fits none of them,
  the "something else" path produces a page rather than asking them to pick one
  that is wrong.
- **The wizard is offered on the empty state, not forced ahead of it.** Forcing
  it would break FR-128 and would put a question between a returning seller and
  their own pages.
- **Examples are drawn from the same domain as the starting points**, so an item
  example reads like something somebody would actually sell rather than "foo".

## Dependencies

- Feature 021, the eight starting points and the picker. The wizard selects from
  them and must not duplicate them.
- Feature 026, `tier.availability` and `tier.leadTime`. The selling mode
  questions have nowhere to write without it.
- Feature 025's surface history handling, which settled what the device back
  gesture does to a surface layered over the editor. FR-133 follows it.
- The existing `openBackup` path, which is how a starter becomes a page without
  destroying the one that is open.
