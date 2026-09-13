# Feature Specification: Bringing In a Page You Already Have

**Feature Branch**: `029-paste-a-page`
**Created**: 2026-09-12
**Status**: Draft
**Input**: Jakob, 2026-09-09: "why can't I import text". Jakob, 2026-09-12:
proceed with the paste feature "so people can improve their menus". The standing
thinking is `docs/ROADMAP.md:259-290`, written before this spec and not
rediscovered here.

## Where this came from

A seller already has a storefront page. It is living on rentry, on pastebin or
on text.is, they wrote it by hand months ago, and it works well enough that
people buy from it. They install this app because they want that page to be
better: prices laid out properly, a unit beside each one, bulk rates, a
made-to-order marker, pictures, a menu file they can send to somebody.

Today the app cannot meet them. Every way in starts from nothing:

| Way in | What it gives them |
|---|---|
| Add a section | An empty form |
| Start from a template | Somebody else's products to overwrite |
| Answer a few questions | A generated page, from answers, not from their page |
| See an example page | Somebody else's page entirely |

So the only route from "my page exists" to "my page is in this app" is retyping
it. A seller with forty products does not retype forty products, and a seller
who would has no reason to prefer this app to the text box they already have.

**The feature is the bridge.** Their page goes in, an editable page comes out,
and every improvement this app has already built becomes available to work they
have already done.

## What already exists, and why none of it is this

Recorded so nobody proposes any of them as a cheaper answer. All three were
considered and rejected before this spec was written.

**Feature 023 pastes a price list INTO one Prices section.** It is the closest
thing and it is not this. It converts lines to price rows inside a section the
seller has already made and already chosen, so it never has to decide what kind
of thing a line is. The remaining gap is splitting a whole page into sections of
several different kinds, which is a different problem.

**The Copy tab opens a saved backup, and only that.** It runs the page validator,
which refuses anything that is not a page this app saved. Widening that picker to
accept `.md` would be WORSE than the gap it closes: every such file is refused,
the seller reads "That file is not a saved page", and the feature looks broken
rather than absent.

**The engine compiles one way only.** A page becomes Markdown; Markdown has
never become a page. There is no partial mechanism to extend, so the work is a
reader, written from nothing, and the shape of this feature follows from that
rather than from the screen it is reached through.

## Decisions taken here, with the reasoning

These are settled by precedent in this codebase rather than by preference, and
they are written down so the plan does not reopen them.

1. **The way in is a paste box, not a file picker.** Jakob: "a lot of users will
   just copy the entire thing from their pastebin/text host and send that clear
   text anyway." A file picker is a secondary path, exactly as it is in feature
   023, and it is not what the feature is called.

2. **The result arrives as its own new page and touches nothing the seller has.**
   Not a choice: it is what every other way of starting a page here already
   does. The example page, all eight starting points and the setup wizard all
   land through `openBackup`, which writes a new page with a new identifier and
   leaves the open one saved. A route that overwrote the current page would be
   the only one in the app that could destroy work, which Principle V forbids.

3. **Nothing is written until the seller presses one button that says what it
   will do.** Feature 023's guarantee, carried over word for word in behaviour:
   until that press the paste is text on a screen, it is not saved, it does not
   compile, and it cannot be published.

4. **Text that is not recognised is kept, never dropped.** Losing a seller's
   words is the worst outcome available to this feature, worse than a wrong
   guess, because a wrong guess is visible and a deletion is not.

5. **The word "import" appears nowhere a seller can read.** It already means
   opening a backup, which REPLACES the open page. Two unrelated things under one
   word is how somebody loses their work.

6. **The schema does not move.** `SCHEMA_VERSION` stays at 5 and the parity
   snapshot must not change. If the reader turns out to need a field that does
   not exist, stop and specify it separately, the way 026 was carved out of 027
   rather than grown inside it.

**Two more were put to Jakob on 2026-09-12 and answered by him**, in the session
that writes them down:

7. **The reader recognises four kinds, not six.** Heading, Divider, Text and
   Prices. Gallery and About you are out of this feature and arrive as Text,
   which keeps every word and leaves both available to a later feature that will
   have real pastes to learn from. FR-029-15 and FR-029-15a.
8. **The seller can swap a proposed section between Text and Prices, and nothing
   else.** Not ticks alone, and not a picker across all six. FR-029-18 says why
   that one pair is the exception.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - My page comes in, and nothing of mine is lost (Priority: P1)

A seller opens their rentry page in a browser, selects all of it, copies, and
comes back to this app. On the empty Build screen there is a control offering to
take a page they already have. They paste. The app shows them what it proposes
to make, in the order they wrote it, with each piece saying what it will become.
They press one button. Their page opens in the editor.

**Why this priority**: This is the entire feature. Without it a seller with an
existing page has no route in except retyping.

**Independent Test**: Paste a real rentry page. Confirm. Read the Build screen
and then the Copy tab. Delivers the whole gap on its own, even if the reader
never learns to recognise a single price.

**Acceptance Scenarios**:

1. **Given** the Build screen with no sections, **When** the seller pastes the
   text of an existing page and confirms, **Then** a new page opens carrying the
   pasted content as editable sections, and the page they had open is still
   listed under Your pages, unchanged.
2. **Given** a paste has been read and shown, **When** the seller never presses
   the confirm button, **Then** no page has been created, nothing has been
   saved, and closing the panel loses only the paste.
3. **Given** a paste containing a line the reader recognises as nothing at all,
   **When** the seller confirms, **Then** that line is present, in its original
   position, inside a Text section, and none of its characters have been altered.
4. **Given** a confirmed paste, **When** the seller reads the Copy tab, **Then**
   the compiled output carries every word that was pasted.
5. **Given** the seller pastes text and then pastes different text over it,
   **When** the panel refreshes, **Then** it describes the second paste and not
   a mixture of the two.

---

### User Story 2 - It works out which parts are my prices (Priority: P1)

The seller's page has a heading, a paragraph about postage, and then thirty
lines of "Item, price". The app proposes a Heading, a Text section and a Prices
section holding thirty items, and says so before anything is made. The prices
land in the price field, the units land in the unit field, and the seller can go
straight to bulk pricing and selling modes on work they did not retype.

**Why this priority**: A page that arrives as one undifferentiated block of text
is barely better than the text box they came from. Prices are the reason this
app exists, and recognising them is what turns a paste into a storefront.

**Independent Test**: Paste a page whose middle is a price list in any of the
shapes feature 023 already reads. Confirm. Open the Prices section and check the
rows against the pasted lines.

**Acceptance Scenarios**:

1. **Given** a paste containing a run of lines that read as products, **When**
   the reader proposes sections, **Then** that run becomes one Prices section
   rather than one section per line.
2. **Given** a Markdown table with a name column and a price column, **When**
   the reader proposes sections, **Then** it becomes a Prices section, and the
   table's rule line does not become a product.
3. **Given** a heading directly above a run of product lines, **When** the
   reader proposes sections, **Then** that heading becomes the Prices section's
   own heading rather than a separate Heading section.
4. **Given** a price the app cannot read as a number, such as "DM me" or "from
   45", **When** the row is made, **Then** the price field carries exactly what
   the seller wrote.
5. **Given** two runs of product lines separated by a paragraph, **When** the
   reader proposes sections, **Then** there are two Prices sections, in order,
   with the paragraph between them.

---

### User Story 3 - I can see what it got wrong before it happens (Priority: P2)

The seller reads the proposal. One paragraph has been read as a Prices section
because it happened to contain a number. They untick it, or change what it will
become, before anything is made. A wrong guess costs one tap and never costs
data.

**Why this priority**: The reader is guessing, and a guess that cannot be
corrected before it lands is a guess the seller has to undo afterwards. It is P2
rather than P1 because a wrong section is editable after the fact, where lost
text is not.

**Independent Test**: Paste text engineered to be misread, correct it in the
panel, confirm, and check that the page matches the corrected proposal rather
than the original guess.

**Acceptance Scenarios**:

1. **Given** a proposal with six sections, **When** the seller unticks one and
   confirms, **Then** the page carries the other five and the unticked one is
   absent.
2. **Given** a proposal, **When** the seller reads it, **Then** every piece of
   the pasted text is accounted for on screen, either inside a proposed section
   or named as text that will be kept as-is.
3. **Given** every section unticked, **When** the seller looks at the confirm
   button, **Then** it is disabled and says nothing will be made.
4. **Given** a run of product lines that was proposed as a Text section, **When**
   the seller changes it to Prices and confirms, **Then** the page carries a
   Prices section whose rows are those lines, read the same way feature 023
   reads them.
5. **Given** a section the seller changed to Prices, **When** they change it back
   to Text, **Then** it holds exactly the text first proposed, not a rendering of
   the rows it briefly became.

---

### User Story 4 - It tells me when this is not a page (Priority: P3)

The seller pastes the wrong thing: a receipt, a URL, one word, an empty
clipboard. The app says what it found rather than making a page out of nonsense
or refusing without explanation.

**Why this priority**: Real, cheap, and it protects the first impression of the
feature. P3 because it does not block anybody who pastes a page.

**Acceptance Scenarios**:

1. **Given** an empty paste box, **When** the seller looks at the panel,
   **Then** there is no proposal and no confirm button to press.
2. **Given** a paste of a single short line, **When** the reader reads it,
   **Then** it proposes one Text section carrying that line, and does not claim
   to have found a page.

---

### Edge Cases

- **Text that has been round tripped through a paste host.** Not byte identical
  to what this app emits, and usually never emitted by this app at all. Windows
  line endings, non-breaking spaces, smart quotes, and trailing spaces used as
  Markdown line breaks all arrive in real pastes.
- **A run of underscores or equals signs under a line**, which is a setext
  heading in Markdown and a plain text habit older than Markdown. Feature 028
  found this being a live defect in the other direction; here it means a line
  that looks decorative is a heading.
- **Inline marks the app supports**, `**bold**`, `*italic*`, `[text](address)`,
  bullets, and, since 028, `~~strikethrough~~` and `==highlight==`. These are
  the Text section's own grammar and carry through untouched.
- **Marks the app does not support**: HTML tags, block quotes, fenced code,
  footnotes, nested lists. They are text, and text is kept.
- **A paste far larger than a page.** Feature 023 caps what it DRAWS at 500
  lines, without capping what it converts, because a checkbox per line means ten
  thousand lines stops a phone rather than slowing it.
- **A paste that is entirely one price list** with no prose at all, and a paste
  that is entirely prose with no prices at all. Both are real pages.
- **A picture address in the text.** The app distinguishes an address anything
  can fetch from a picture held on this device, and only the first kind can come
  out of a paste.
- **A heading at the very top.** The document has an optional title that only
  the seller sees, in the pages list.
- **Pasting twice.** The second paste must describe itself, not the first.
- **The seller closes the panel, or leaves the surface, mid-paste.**

## Requirements *(mandatory)*

### Functional Requirements

**Getting the text in**

- **FR-029-01**: Sellers MUST be able to paste the whole text of an existing page
  into the app from the Build screen when they have no sections yet, through a
  control whose words describe bringing in a page they already have.
- **FR-029-02**: The control and every word around it MUST avoid the word
  "import", which already means opening a backup.
- **FR-029-03**: A file on the device MAY be offered as a secondary way to fill
  the same box, as feature 023 offers one, and MUST NOT be the primary path.
- **FR-029-04**: The panel MUST accept text of any length, and MUST bound what it
  DRAWS rather than what it accepts, saying on screen when it has done so.

**Reading it**

- **FR-029-05**: The reader MUST turn one block of text into an ordered sequence
  of proposed sections drawn only from the kinds the schema already carries.
- **FR-029-06**: The reader MUST NOT discard any part of the pasted text. Every
  character either lands in a proposed section or is named on screen as text that
  will be kept.
- **FR-029-07**: The reader MUST recognise Markdown headings, both the `#` form
  and the underlined form, and propose them as Heading sections.
- **FR-029-08**: The reader MUST recognise runs of product lines and Markdown
  tables as a single Prices section rather than one section per line, reusing the
  line reading that feature 023 already ships rather than duplicating it.
- **FR-029-09**: A heading immediately above a run of product lines MUST become
  that Prices section's heading rather than a separate Heading section.
- **FR-029-10**: The reader MUST keep whatever the seller wrote in a price
  verbatim, including prices that are not numbers.
- **FR-029-11**: The reader MUST keep inline marks verbatim inside text it
  proposes as a Text section, because the app's Text sections use the same
  grammar.
- **FR-029-12**: The reader MUST treat text it cannot classify as a Text section,
  preserving line order and the seller's own line breaks.
- **FR-029-13**: The reader MUST be pure: the same text in produces the same
  proposal out, with no reading of the clock, the network, the document or the
  screen.
- **FR-029-14**: The reader MUST tolerate text round tripped through a paste
  host, specifically both line ending conventions and leading or trailing
  whitespace on any line.
- **FR-029-15**: The reader MUST recognise exactly four kinds: Heading, Divider,
  Text and Prices. Jakob chose this on 2026-09-12 over reading all six.
- **FR-029-15a**: The reader MUST NOT produce a Gallery or an About you section.
  Image links and contact blocks MUST arrive as Text, carrying exactly what was
  written, which is the fallback FR-029-12 already guarantees. This loses none of
  the seller's words and leaves both kinds available to a later feature that has
  real pastes to learn from.
- **FR-029-15b**: The reader MUST recognise a horizontal rule, in each of the
  forms Markdown accepts, as a Divider.

**Confirming it**

- **FR-029-16**: The panel MUST show every proposed section in the order it will
  appear, each saying what kind of section it will become and showing enough of
  its content to be recognised.
- **FR-029-17**: Sellers MUST be able to exclude any proposed section before
  anything is made.
- **FR-029-18**: Sellers MUST be able to change a proposed section between Text
  and Prices, in both directions, before confirming. Jakob chose this on
  2026-09-12 over ticks alone and over a full picker across all kinds.

  **It is those two and no others for a stated reason.** A wrong guess in this
  app is normally cheap, because unticking it costs one tap and the section can
  be built by hand afterwards. This one pair is the exception: the editor has no
  way to turn a Text section into a Prices section, so a price list read as prose
  costs the seller a second paste at best and retyping at worst. Nothing sensible
  turns a paragraph into a Divider, so a picker across all six kinds would ship
  paths nobody uses.
- **FR-029-18a**: Changing what a section will become MUST re-read that section's
  own pasted text rather than converting the guess, so swapping to Prices and
  back returns exactly what was first proposed.
- **FR-029-19**: Nothing MUST be written to storage, to the open document or to
  any page until the seller presses the confirm control.
- **FR-029-20**: The confirm control MUST state how many sections it will make,
  and MUST be unavailable when that number is zero.
- **FR-029-21**: The count on the confirm control MUST be the number of sections
  actually made, never a count of ticks that includes something the conversion
  will drop.

**Where it lands**

- **FR-029-22**: Confirming MUST create a new page with its own identifier and
  MUST leave every existing page, including the one open at the time, saved and
  unchanged.
- **FR-029-23**: The app MUST tell the seller the page arrived as a new page and
  where their previous page still is.
- **FR-029-24**: The new page MUST be immediately editable by every control the
  app already has, and MUST compile, preview and publish without any further
  action.
- **FR-029-25**: The page's optional title MUST be taken from the paste when the
  paste opens with a heading, and MUST otherwise be left unset rather than
  invented.
- **FR-029-26**: Every section the feature creates MUST pass the page validator,
  so a paste can never produce a page that cannot be saved or reopened.

**When it is not a page**

- **FR-029-27**: An empty or whitespace-only paste MUST produce no proposal and
  no confirm control, rather than an error.
- **FR-029-28**: A paste that yields exactly one Text section MUST still be
  offered, because one paragraph is a legitimate page, and MUST NOT be described
  as a page having been recognised.

**Keeping the promise about pictures**

- **FR-029-29**: Any picture address the feature takes from the text MUST be
  treated as an address that can be published, never as an identifier for a
  picture held on this device, because nothing in a pasted page can refer to this
  device's storage.

### Key Entities

- **Paste**: the text the seller put in the box. Held only while the panel is
  open, never saved, and discarded when they leave.
- **Proposed section**: one piece of the reader's suggestion. Carries the kind it
  will become, the content it will carry, the range of pasted text it came from,
  and whether the seller has kept it. Exists only on screen.
- **Proposal**: the ordered list of proposed sections, which is a pure function
  of the paste and is therefore recomputed rather than stored beside it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A seller with an existing page of about thirty products reaches an
  editable page carrying all of it in under two minutes, without typing any of
  their own content into the app.
- **SC-002**: Every character of any pasted text is present in the confirmed page
  or visibly accounted for before confirming, measured over generated pastes
  rather than a handful of examples. This is the feature's one absolute.

  **It has exactly one exception and it is named here rather than discovered
  later.** A Windows line ending's carriage return is dropped, because the reader
  splits on `\r?\n` and the app's own documents are `\n` throughout. That is the
  paste's transport convention, not anything the seller wrote. Every other
  character survives, smart quotes, trailing spaces and non breaking spaces
  included. Added 2026-09-12, when chunk 1 proved the original wording could not
  be met literally.
- **SC-003**: For a page whose prices are laid out in any of the shapes feature
  023 already reads, at least 90 percent of product lines arrive as price rows
  rather than as prose.
- **SC-004**: A seller can correct any single wrong guess before confirming with
  at most one tap per wrong guess.
- **SC-005**: No confirmed paste ever produces a page that fails to save, reopen,
  compile or publish.
- **SC-006**: Pasting and confirming never changes, removes or overwrites any
  page the seller already had, verified by checking every stored page before and
  after.
- **SC-007**: A paste of 2000 lines is read and drawn on a phone without the
  screen becoming unresponsive.

## Assumptions

- The seller can copy text from their paste host. This is the same assumption
  feature 023 already makes, and the same assumption that publishing makes in the
  other direction.
- The pasted text was written by a person, or by some other tool, and was almost
  never emitted by this app. The reader is built for messy human Markdown and
  plain text, not for its own output.
- Existing pages are what Principle V protects, so arriving as a new page is
  safety rather than convenience.
- The line reading in feature 023 is good enough to reuse for the price half of
  this problem. If it turns out not to be, improving it is in scope and replacing
  it is not.

## Out of scope

- **Fetching a page from a URL.** Declined in `specs/023-import/spec.md` with
  reasons, and nothing here changes them.
- **Any schema change.** `SCHEMA_VERSION` stays at 5 and
  `engine/tests/document/parity.snapshot.json` must not move.
- **Widening the Copy tab's backup picker.** Explained above: it would look
  broken rather than absent.
- **Bringing in pictures themselves**, as opposed to addresses that already point
  at pictures somebody else is hosting.
- **Reading a Gallery or an About you section out of a paste.** Decided by Jakob
  on 2026-09-12, see FR-029-15a. Both arrive as Text, which keeps every word, and
  both stay available to a later feature that will have real pastes to learn
  from rather than guesses about them.
- **A picker offering all six kinds at the confirm step.** See FR-029-18. Two
  kinds are swappable because one swap is expensive to undo later; the rest are
  not.
- **Compiling a page back out to the exact bytes it came in as.** This reads a
  page into the app's own model, which is lossy by design in one direction: the
  model has six kinds and Markdown has more.
