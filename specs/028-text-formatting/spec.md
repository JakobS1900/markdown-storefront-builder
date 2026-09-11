# Feature Specification: Formatting Buttons Over a Text Section

**Feature Branch**: `028-text-formatting`
**Created**: 2026-09-11
**Status**: Draft
**Input**: A tester's feedback, quoted in full below, plus Jakob's three decisions
of 2026-09-11 recorded under "Decisions".

## Where this came from

First hand, from somebody using the app:

> I love this! But I feel like im missing the option to in text be able to
> change/do to the code things these sites do. Like bold font itacls,
> highlighting, those are only 3 basic features but theres so many esp when
> working with text editors like this

**Two of those three already work.** Feature 008 shipped bold, italic, links and
bullet lists inside a Text section on 2026-08-21. The Text field's own hint says
so:

> Blank line between paragraphs. `**bold**`, `*italic*`,
> `[text](https://address)` for a link, and lines starting with a dash for a
> list.

A person read that and still reported the feature as missing. That is the whole
finding, and it is not a documentation problem. The constitution's first line
says this project is "for people who do not know Markdown". A hint that tells
somebody to type asterisks asks them to know Markdown. **The mechanism was
built. The affordance never was.**

This is the fifth time a feature people asked for turned out to already exist
here, after the per item price table, headings, pages being saved, and
categories. The previous four were fixed by renaming a control. This one cannot
be, because there is no control at all.

Highlighting is the one genuinely missing thing in the feedback. Strikethrough
is specified alongside it because it is the same shape of change, it is the
other mark people expect from a text editor, and doing it separately would mean
regenerating the same golden files twice.

## Decisions

Made by Jakob on 2026-09-11, in the session that writes them down:

1. **Everything ships in one release.** Six buttons and both new marks, as
   `v0.11.0`. A phased option was offered with its costs stated and declined.
2. **A mark a host cannot render prints plain, and the seller is told.** Not
   silently substituted with bold, and not a button that appears and vanishes as
   the host changes.
3. **Pasting a whole existing page is not in this feature.** It is specified
   separately once this ships.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - I can make a word bold without knowing how (Priority: P1)

A seller writing their returns policy wants the word "deposit" to stand out.
They select it and press a button marked **B**. The word is bold. They never see
an asterisk, and they never had to know there was one.

**Why this priority**: This is the entire feedback, and it needs no new
compiling. Everything below the button already works and has since feature 008.

**Independent Test**: Select a word in a Text section, press each button, read
the Copy tab. Delivers the whole reported gap on its own, even if the two new
marks are never built.

**Acceptance Scenarios**:

1. **Given** a Text section containing "Pay a deposit first" with "deposit"
   selected, **When** the seller presses Bold, **Then** the field reads
   "Pay a **deposit** first", the word is still selected, and the published page
   shows "deposit" in bold.
2. **Given** the same selection already bold, **When** the seller presses Bold
   again, **Then** the markers are removed and the word is plain.
3. **Given** the caret sitting in empty space with nothing selected, **When**
   the seller presses Italic, **Then** a short placeholder word appears between
   the markers and is selected, so the next thing they type replaces it.
4. **Given** any of the buttons is pressed, **When** the press completes,
   **Then** the seller can keep typing where they were without touching the
   field again.
5. **Given** three lines selected, **When** the seller presses the list button,
   **Then** each line becomes a bullet, and pressing it again removes them.
6. **Given** a word selected, **When** the seller presses the link button,
   **Then** the word becomes the link's visible text and the cursor waits where
   the address goes.

---

### User Story 2 - Nothing I type can break my page (Priority: P1)

The same property feature 008 was built to keep. A seller can write about
prices, maths, file names and emoticons without any of it turning into
structure on somebody else's website.

**Why this priority**: It is the narrow gate, and this feature widens the set of
characters that mean something. Specification of the buttons is worthless if it
comes at the cost of this.

**Independent Test**: Compile the hostile corpus and compare it to the golden
files byte for byte.

**Acceptance Scenarios**:

1. **Given** a seller writes "2 * 3 = 6", **When** the page is published,
   **Then** it reads "2 * 3 = 6" and no part of it is emphasised.
2. **Given** a seller writes a row of equals signs under a line of text,
   **When** the page is published, **Then** it is a row of equals signs and not
   a heading.
3. **Given** a seller writes a stray pair of marks with no partner, **When** the
   page is published, **Then** the marks appear as the characters they typed.
4. **Given** a seller writes something that looks like a construct this feature
   does not implement, **When** the page is published, **Then** it is text.

---

### User Story 3 - I can highlight and strike out (Priority: P2)

A seller marks a discontinued item struck through, and highlights the words
"limited run" so a buyer's eye lands on them.

**Why this priority**: Genuinely new, and half the feedback. Below the buttons in
priority only because the buttons are what was actually asked for and these two
marks are what the buttons do once they exist.

**Independent Test**: Write both marks, compile for each host, compare against
that host's golden file and against what that host actually renders.

**Acceptance Scenarios**:

1. **Given** a word marked as highlighted and a host that can show it, **When**
   the page is published, **Then** the word is highlighted.
2. **Given** a word marked as highlighted and a host that cannot show it,
   **When** the seller looks at the page before publishing, **Then** the word is
   plain **and** a message names the section and says the host will not show it.
3. **Given** the same page, **When** the seller switches hosts to one that can
   show it, **Then** the message goes away and the highlight appears.

---

### Edge Cases

- **A mark that would span a blank line.** Left as literal characters. A stray
  marker must not swallow the rest of somebody's writing looking for a partner.
- **A mark inside a bullet, and a bullet inside a mark.** Formatting applies
  inside list items, as it already does for bold and italic.
- **A button pressed while the software keyboard covers half the screen.** The
  buttons must still be reachable and the selection must survive the press.
- **Several Text sections on one page.** Someone listening to the page rather
  than looking at it must be able to tell one section's Bold button from
  another's.
- **A mark wrapped around a selection that already carries it.** Pressing the
  button again takes it off rather than doubling it.
- **A seller who types the markers by hand.** Still works. The buttons are an
  addition, not a replacement.
- **A host whose support for a mark cannot be observed.** Recorded as not
  supported, which is the conservative direction, rather than assumed from a
  family resemblance to another host.

## Requirements *(mandatory)*

### Functional Requirements

**The buttons**

- **FR-028-1**: A Text section MUST offer buttons for bold, italic,
  strikethrough, link, bullet list and highlight, positioned with the field they
  act on.
- **FR-028-2**: The buttons MUST appear only where the formatting they promise
  is actually honoured. They MUST NOT appear on fields whose contents are
  published as plain text.
- **FR-028-3**: With text selected, a button MUST apply its formatting to the
  selection and leave that selection standing.
- **FR-028-4**: With nothing selected, a button MUST insert its formatting
  around a short placeholder word and select that word.
- **FR-028-5**: A button pressed on a selection that already carries its
  formatting MUST remove it rather than nest it.
- **FR-028-6**: The link button MUST treat the selection as the link's visible
  text and leave the insertion point where the address is typed.
- **FR-028-7**: The list button MUST apply to every line the selection touches,
  and MUST remove the bullets when pressed a second time.
- **FR-028-8**: Pressing a button MUST NOT move the seller's place in the field
  and MUST NOT discard anything they have typed.
- **FR-028-9**: Every button MUST carry an accessible name that distinguishes it
  from the same button belonging to another section on the same page.
- **FR-028-10**: Every button MUST present a touch target of at least 44 by 44
  CSS pixels and MUST be operable by keyboard.
- **FR-028-11**: The written hint on the field MUST remain, because it still
  serves somebody who would rather type than tap.

**The marks**

- **FR-028-12**: Strikethrough and highlight MUST be recognised inside a Text
  section, and MUST be recognised the same way whether the seller typed them or
  pressed a button.
- **FR-028-13**: The grammar MUST remain a whitelist. Adding a construct MUST
  stay a deliberate change and MUST NEVER be a consequence of what somebody
  types.
- **FR-028-14**: Everything outside the recognised constructs MUST remain
  text, including anything that resembles a construct and is not one.
- **FR-028-15**: Whether a host renders a mark MUST be recorded per host, with
  a written source for each value. A value MUST NOT be written from assumption
  or from resemblance to another host.
- **FR-028-16**: Where a host does not render a mark, the marked words MUST be
  published as plain text, unmarked, with nothing left over for the reader to
  see.
- **FR-028-17**: That fallback MUST raise a message naming the section it
  happened in, and that message MUST be visible to the seller before they
  publish.
- **FR-028-18**: The preview MUST show the marks as the chosen host would show
  them, including showing them absent where the host cannot.
- **FR-028-19**: The saved menu file MUST show the marks, because it is
  rendered by this application rather than by a host.

**What must not move**

- **FR-028-20**: This feature MUST NOT change the document schema. The stored
  shape of a page MUST be unchanged, and a page saved before this feature MUST
  open unchanged after it.
- **FR-028-21**: No existing page's published output MUST change except where a
  seller has used one of the two new marks.

### Key Entities

- **Text section**: a passage of a seller's own writing, stored as one string.
  The only place in the product where a seller's words may carry formatting.
- **Host**: somewhere a page is pasted or saved. Already described by a record
  of what it can and cannot do, which this feature extends by two entries.
- **Mark**: one of six things a seller can apply to their words. Four exist and
  gain a button; two are new.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-028-1**: A seller can bold, italicise, strike out, highlight, link and
  bullet their text without typing a punctuation mark for any of it.
- **SC-028-2**: Somebody who has never written Markdown can apply each of the
  six on a phone, first try, without reading the hint.
- **SC-028-3**: The hostile corpus produces no structure on any host. Zero
  constructs reach a published page that the seller did not ask for.
- **SC-028-4**: Every page that does not use the two new marks publishes byte
  for byte what it published before this feature, on every host.
- **SC-028-5**: A seller who marks a word for a host that cannot show it learns
  so before publishing, not after.
- **SC-028-6**: Every host's support for each new mark is backed by a written,
  dated observation or a cited document, with no value carried over from another
  host.
- **SC-028-7**: The accessibility gate counts more controls than it did before
  this feature. A gate whose count does not move has not seen the buttons.

## Assumptions

- **The four existing constructs need no engine work.** Feature 008's grammar
  already recognises bold, italic, links and bullet lists in a Text section.
  This is the load bearing assumption: if it is wrong, the scope roughly
  doubles. It was read directly in the code during planning, not inferred from a
  passing test.
- **A row of buttons is the right answer rather than a richer editor.** Typing
  into a plain box with buttons above it is what every paste host and forum this
  audience already uses. A live formatted editing surface is a much larger
  feature and was not asked for.
- **Six buttons fit a 390 pixel phone.** To be measured rather than assumed, and
  it is the width the project already gates against.
- **The marks are wanted in a Text section and nowhere else.** Nobody asked to
  bold a product name or a price, and those fields are published as plain text
  today.
- **Strikethrough is supported more widely than highlight.** Highlight is not
  part of any common Markdown baseline. This is why the fallback exists and is
  not an afterthought.

## Dependencies

- Feature 008, the inline grammar and its whitelist.
- Feature 013, the escaper, and the escape verification research behind it.
- The host capability records and their sourcing rule, from features 002 and
  018.

## Out of scope, deliberately

- **Pasting a whole messy existing page** from rentry or pastebin. Named as the
  next feature and specified separately once this ships. Decision 3.
- **Formatting on any field other than a Text section.** Product names, prices,
  details, what is included and payment methods are all published as plain text,
  and a button on them would promise something the compiler refuses.
- **Headings, quotes, inline code, colour, underline and spoilers.** Some hosts
  offer these. Sections already provide headings, and the rest were not asked
  for. Each is a deliberate addition to a whitelist, which is the point of
  having one.
- **A live formatted editing surface.** See Assumptions.
- **Any change to the document schema.** FR-028-20. If something here appears to
  need a new field, it is specified separately rather than grown inside a
  surface feature, the way feature 026 was carved out of 027.
