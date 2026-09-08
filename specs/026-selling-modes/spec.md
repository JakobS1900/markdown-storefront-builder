# Feature Specification: Selling modes

**Feature Branch**: `026-selling-modes`
**Created**: 2026-09-08
**Status**: Draft
**Input**: User description: "Selling modes: whether an item is in stock, made to order or a preorder, and how long a buyer waits"

## Where this came from

Jakob, on 2026-09-07, describing what a wizard would need to ask:

> What are you selling? Are you selling it in any specific quantities? Is it
> something that you're making from home? Is it something that is already good
> that you have? Is it something that is going to be a preorder? Or we could add
> a field for whether this is going to be something that buyers will have to
> wait for after they buy it from the seller, because they'll have to make it.
> Is the item being sold by wait, or by quantity, or both?

Underneath the wizard's questions is a fact the app has no way to record. A
price list can say what something costs and what that price buys. It cannot say
that the thing does not exist yet, or that it will be made after somebody pays,
or that they will wait three weeks for it.

Sellers already work around it. The workaround is a `details` line reading
"Made to order: 2 weeks", which is free text the app cannot read, cannot lay out
consistently, cannot ask about, and cannot warn on.

**This lands before the wizard on purpose.** A wizard built first would have to
ask these questions against fields that do not exist and write the answers into
free text, and every one of those answers would have to be found and migrated
later. The order is not a preference.

## What this is not

**Not the wizard.** Feature 027 asks the questions. This gives the answers
somewhere to go, and is useful on its own: a seller can mark an item made to
order today, by hand, without any wizard existing.

**Not stock counting.** How many are left is a different feature with a
different shape, and nobody has asked for it.

**Not a status the app maintains.** Nothing here expires, counts down, or
changes on its own. A preorder that has shipped is a seller editing their page.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Say that something is made after it is bought (Priority: P1)

Somebody carving signs at home sells nothing off a shelf. Every order is started
when it is paid for. They mark their items as made to order and say roughly how
long it takes, and their published page says so on every line rather than in a
paragraph somebody has to notice.

**Why this priority**: It is the case the request is built around, and the one
the workaround serves worst. A buyer who does not know they are waiting three
weeks is a complaint, and the seller finds out afterwards.

**Independent Test**: Mark an item as made to order with a lead time, compile
it, and confirm the published page says so beside that item.

**Acceptance Scenarios**:

1. **Given** a price row, **When** the seller marks it made to order and says
   how long, **Then** the compiled page shows both against that item.
2. **Given** a page with some items in stock and some made to order, **When** it
   is published, **Then** each item says which it is, and the buyer can tell
   them apart at a glance.
3. **Given** an item with no selling mode set, **When** the page is published,
   **Then** nothing is said about it at all, and the output is byte for byte
   what it was before this feature.

---

### User Story 2 - Take orders for something that does not exist yet (Priority: P2)

A seller opens a run of prints before making them. Buyers are paying for
something that will ship in March.

**Why this priority**: A real case, described in the request, and distinct from
made to order: a preorder is scheduled and a made to order item is queued. It is
second because it shares its whole shape with story 1 and adds one value.

**Independent Test**: Mark an item as a preorder with a lead time and confirm
the page says so.

**Acceptance Scenarios**:

1. **Given** a price row, **When** the seller marks it a preorder, **Then** the
   page says so, and says it differently from made to order.

---

### User Story 3 - Say how long the wait is, whatever the mode (Priority: P2)

"About two weeks." "Three to five days." "Ships in March."

**Why this priority**: The wait is the thing the buyer actually wants to know,
and it is worth saying even where the mode is obvious.

**Independent Test**: Set a lead time with each mode and confirm it reads
correctly in the output.

**Acceptance Scenarios**:

1. **Given** any selling mode, **When** the seller adds a wait, **Then** it
   appears with the mode rather than as a separate fact.
2. **Given** a wait and no mode, **When** the page is published, **Then** the
   wait is still shown, because how long something takes is worth saying even
   when the reason is not stated.

---

### Edge Cases

- **Neither field set**, which is every existing page and most rows. Nothing is
  said and nothing changes.
- **A wait with no mode**, and a mode with no wait. Both are valid and read
  sensibly on their own.
- **A page written before this feature.** Opens unchanged, publishes unchanged.
- **A page written after it, opened by an older build.** Refused cleanly and
  offered back as its exact bytes, which is the existing guarantee and must not
  be weakened.
- **A seller who has already written "Made to order" into a details line.** The
  app cannot know that and must not try to guess. They now have two ways to say
  it, and this feature is not entitled to rewrite their words.
- **Text a seller types into the wait**, including a newline or a pipe, which
  would break a table cell if it reached one unescaped.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-108**: A price row MUST be able to record whether the item is in stock,
  made to order, a preorder, or sold out.
- **FR-109**: A price row MUST be able to record how long a buyer waits,
  independently of which mode is set, including with no mode set at all.
- **FR-110**: Both MUST be optional. A row with neither MUST compile to exactly
  what it compiled to before this feature, byte for byte, for every host.
- **FR-111**: Where a mode is set, the compiled page MUST say so against that
  item, in words a buyer understands rather than the value the app stores.
- **FR-112**: Where a wait is set, it MUST appear with the mode rather than as a
  separate fact, so "made to order, about two weeks" reads as one statement.
- **FR-113**: The wait MUST be free text. Sellers write "about 2 weeks", "3 to 5
  days" and "ships in March", and a date or a number would refuse most of those
  or discard what was written.
- **FR-114**: Text a seller types MUST NOT be able to break the layout of the
  published page, in the same way and by the same means every other field they
  type is already protected.
- **FR-115**: The stored page format MUST carry the mode as a fixed set of
  values, so that the app can lay it out consistently and later features can ask
  about it.
- **FR-116**: A page written by an earlier version MUST open unchanged and MUST
  NOT acquire either field. An absent optional field MUST NOT be created with an
  empty value.
- **FR-117**: The seller MUST be able to set and clear both fields from the
  editor, and clearing MUST return the row to saying nothing rather than to
  saying something empty.
- **FR-118**: Neither field may change how a page is saved, when it is saved, or
  what an existing page compiles to.

### Key Entities

- **Selling mode**: one of a fixed, small set describing how an item reaches a
  buyer. Not a stock count, not a status the app maintains, and not a date.
- **The wait**: free text describing how long a buyer waits, meaningful with or
  without a mode.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every page that exists today compiles to byte identical output for
  every host after this feature, proven by compiling them rather than by
  reasoning about them.
- **SC-002**: A buyer reading a published page can tell, for each item, whether
  it is on a shelf, made after they pay, or not made yet, without reading a
  paragraph elsewhere on the page.
- **SC-003**: A seller can set a mode and a wait on an item in under 15 seconds,
  from the row they are already editing.
- **SC-004**: No text a seller can type into either field can break the table or
  the page, across the project's hostile text corpus.
- **SC-005**: A page carrying both fields round trips through save, reopen,
  export and restore with both intact.

## Assumptions

- **Per item, not per page.** A seller can have stock items and commissions side
  by side, and that is a lot of the people this app is for. A page level default
  would be fewer controls and would be wrong for exactly them. Setting many rows
  at once is a job for the bulk controls that already exist, and is not part of
  this feature.
- **Four modes**: in stock, made to order, preorder, sold out.

  This was specified as three, with "sold out" deliberately left out, on the
  reasoning that `price` is already free text precisely because sellers write
  things like "DM me", so writing "SOLD OUT" there is what they already do and a
  second way to say it would split the practice.

  **Jakob overruled it on 2026-09-08: "people use that a lot."** That is first
  hand knowledge of the sellers this is for, and it is exactly the evidence the
  original reasoning lacked. The argument was not wrong about the workaround
  existing; it was wrong about what the workaround means. A thing people do
  constantly through a field that was not designed for it is a missing feature,
  not a settled convention.

  It was worth deciding now rather than later, which is why it was raised as the
  one expensive choice: an older build refuses a page carrying an enum value it
  does not recognise, so a fourth value added in a later version would make new
  pages unreadable to builds already installed.

- **Sold out and a wait are not exclusive.** "Sold out, back in about two weeks"
  is a useful sentence and the seller is entitled to write it. Nothing here
  refuses a wait because of the mode it sits beside.
- **The wait is text, not a date.** For the same reason `price` and `unit` are.
- **Nothing is inferred.** A seller who has written "Made to order" into a
  details line keeps exactly what they wrote. The app does not read it, move it,
  or offer to.
- **No host capability is involved.** Every host can render words, so this adds
  no capability flag and no target changes.
