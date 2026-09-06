# Feature Specification: The menu file

**Feature Branch**: `024-menu-file`
**Created**: 2026-09-06
**Status**: Draft
**Input**: User description: "The menu file: a self contained HTML menu a seller can save and send, pictures held on the device, and making the per item price breakdown findable"

## Where this came from

People outside the project are using the app. One of them asked for three things
at once, and the request is quoted rather than paraphrased because two of the
three turned out to be answered already and the wording is what shows why:

> I want to be able to have an offline saved menu to show or send people when
> out and about as a file, especially because these paste and host sites can be
> janky for me. If I download an .md file it won't have the cool fancy graphics
> and I won't be able to send a nice smooth menu. Also people said the store
> should be more organised like: Oranges | PRICE, so like a table, then below
> that the amount then price, so like 1lb | 7$. Then what if users want to do
> headers, or what if users are making the local menus, I assume we can have
> them locally upload images giving people more control?

**Two of the three already exist and are merely unfindable.** This is the
finding that shaped the feature, and it was checked by reading the code rather
than assumed:

- The per item price breakdown is emitted today. When any row carries a real
  quantity break, the whole section switches to a per item layout: the item's
  name and price as a sub heading, then that item's own two column table of
  amounts and prices. That is what was asked for. The control that produces it
  sits inside a collapsed `More details` fold under the label `Bulk pricing`.
- Headings exist as one of the six section kinds, at levels one to six, and
  Prices, Text and Gallery sections each carry their own heading.

So the new work is the saved file and the pictures. The third request is a
labelling problem, and it is included here because it is the same complaint the
project already has first hand evidence for: a blank field with a label over it
does not tell somebody what to type.

## The constraint that shapes everything

The owner's instruction, given on 2026-09-06: pictures held on the device must
be **locked to the saved file**, so that nobody adds one, pastes their page to a
host, and finds it missing with no explanation.

This is not a nicety. The app's whole purpose is to produce text a seller pastes
into a public host, and a picture that lives on the seller's phone cannot travel
in pasted text. A seller who does not understand that boundary will publish a
page with holes in it and blame the app, which is the failure this feature has
to design out rather than warn about.

There is also a hard technical fact behind it, already recorded in the compiler:
one of the supported hosts states a page limit of 200000 bytes. A single photo
at the size the app already downscales to would exceed that entire budget on its
own. Embedding pictures in pasted output is not a trade off with a good side.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a menu and send it to somebody (Priority: P1)

A seller at a market has their price list in the app. Somebody asks to see what
they sell. Rather than reading out a link, or pasting to a host over a
connection that may not be there, the seller saves their page as a single menu
file and sends it straight from their phone.

The person who receives it opens it and sees the menu laid out the way the app
lays it out: headings, a price table with the columns lined up, the pictures.
It works with no connection, no account, and nothing installed.

**Why this priority**: It is the request. It is also the only story that
delivers value on its own: a menu file carrying pictures the seller already has
as web addresses is useful the day it ships, before any of the storage work
exists.

**Independent Test**: Build a page, save the menu file, open the saved file on
a device with networking disabled, and confirm it renders with its styling and
reflows without sideways scrolling on a narrow screen.

**Acceptance Scenarios**:

1. **Given** a page with a heading, a price table and at least one picture,
   **When** the seller saves it as a menu file, **Then** one file is produced
   that opens in a browser and shows all three.
2. **Given** the saved menu file and a device with no network connection,
   **When** the file is opened, **Then** the layout and styling are intact and
   no picture that could be embedded is missing.
3. **Given** the saved menu file opened on a narrow screen, **When** it is
   read, **Then** the page does not scroll sideways and the price table remains
   readable.
4. **Given** a seller who has selected a paste host, **When** they save a menu
   file, **Then** the menu file is unaffected by which host is selected,
   because a file is not a host.

---

### User Story 2 - Use a picture from this device (Priority: P2)

A seller photographs what they are selling. Rather than finding somewhere to
host the photo and copying an address back, they choose the picture from their
device and it appears in their menu file.

Before they choose it, and again if they look at their page for a paste host,
the app tells them plainly that this picture lives on their device and travels
in the menu file only.

**Why this priority**: It is what makes story 1's file genuinely offline, and it
removes the single most awkward step in the product. It is second because story
1 has standalone value and this one does not: a picture with nowhere to appear
is not a feature.

**Independent Test**: Add a picture from the device to a price row, save the
menu file, open it with no connection, and confirm the picture is there. Then
select a paste host and confirm the picture is absent from the pasted text and
that a warning names it.

**Acceptance Scenarios**:

1. **Given** a price row, **When** the seller adds a picture from their device,
   **Then** it appears in the preview of the menu file and in the saved file.
2. **Given** a page containing a picture from the device, **When** the seller
   views or copies the text for a paste host, **Then** the picture is absent
   from that text and a warning names the picture and says where it does appear.
3. **Given** a page containing a picture from the device, **When** the seller
   copies the text for a paste host, **Then** nothing in that text identifies
   the picture, the device, or its original filename.
4. **Given** a device with no room left, **When** the seller tries to add a
   picture, **Then** they are told specifically that storage is full, how much
   is in use, and what to do, and their page is unharmed.
5. **Given** a seller who wants the space back, **When** they look at their
   pictures, **Then** they can see what each one costs in storage and remove
   ones they choose, and nothing removes anything on their behalf.

---

### User Story 3 - Find the price breakdown (Priority: P3)

A seller listing produce wants "Oranges" and its price on one line, with "1 lb"
and "5 lb" and their prices underneath. The app already produces exactly that.
The seller cannot find the control, because it is called something that does not
describe it and it is behind a fold.

**Why this priority**: Smallest change in the feature and it answers a real
complaint, but it is a relabel rather than a capability, so nothing depends on
it and it can ship in any order.

**Independent Test**: Show a seller who has not used the app the price row form
and ask them where they would put "1 lb for 7 dollars, 5 lb for 30". Success is
that they open the right fold and find the right field.

**Acceptance Scenarios**:

1. **Given** a price row, **When** the seller opens `More details`, **Then**
   the field that produces quantity breakdowns is named and hinted in terms of
   what it does to the page, not in terms of a pricing concept.
2. **Given** a blank price row, **When** it is first drawn, **Then** it still
   asks for exactly two things, because the fold is not being opened up.

---

### Edge Cases

- **A page with no pictures at all.** The menu file is still produced and is
  smaller. Nothing about the feature is conditional on pictures existing.
- **A picture whose web address cannot be read into the file.** Some websites
  refuse to let another page read their images, and that refusal is theirs to
  make and cannot be worked around. That picture stays as a web address in the
  saved
  file, so it works with a connection and not without one, and the seller is
  told which picture by name rather than discovering a hole later.
- **A very large menu file.** Several photographs embedded in one file produce a
  large file. The seller is told the size before or as it is saved, since a file
  too large to send is a failure they need to see at save time.
- **Storage full while saving a page, not while adding a picture.** The page
  itself must still be recoverable, and the message must say so, because the
  seller's fear at that moment is that they have lost their work.
- **A page saved by an older version of the app.** It opens and behaves exactly
  as before, with no pictures on the device and nothing new to fill in.
- **A page saved by a newer version.** It is refused without being read, and the
  seller is still offered their exact saved bytes back, unchanged by this
  feature.
- **A picture that is deleted from storage while a page still points at it.**
  The page still opens, the menu file is still produced, and the missing picture
  is reported by name rather than rendering as a broken image.
- **Hostile text in a seller's own fields, carried into the saved file.** The
  saved file is a document that other people open. Nothing a seller types may
  become anything executable in it.

## Requirements *(mandatory)*

### Functional Requirements

**The menu file**

- **FR-070**: Sellers MUST be able to save their page as a single file that
  renders as a laid out menu, without a connection, without an account, and
  without installing anything.
- **FR-071**: The saved file MUST be self contained. Everything needed to
  display it correctly MUST be inside the one file, other than pictures
  explicitly reported as not embeddable under FR-076.
- **FR-072**: The saved file MUST show what the app's own preview shows for it,
  and MUST be produced from the same compiled output the preview renders, so the
  two cannot diverge. Constitution Principle VII.
- **FR-073**: The saved file MUST remain readable on a narrow screen: it MUST
  reflow, and MUST NOT require sideways scrolling of the page itself.
- **FR-074**: The saved file MUST be produced independently of which paste host
  the seller has selected, in the same way and for the same reason the existing
  plain text file already is.
- **FR-075**: Nothing a seller types anywhere in their page may become
  executable content in the saved file, for any input. Constitution Principle
  IV.
- **FR-076**: Where a picture held at a web address cannot be embedded, the
  saved file MUST still be produced, that picture MUST remain usable with a
  connection, and the seller MUST be told which picture by name. Silently
  producing a file with a hole in it is a defect.
- **FR-077**: The seller MUST be told the size of the saved file at the point of
  saving, because a file too large to send is a failure that must be visible
  then rather than discovered later.

**Pictures held on the device**

- **FR-078**: Sellers MUST be able to choose a picture from their device for any
  place the app already accepts a picture address, and those places MUST all
  behave the same way as each other.
- **FR-079**: A picture held on the device MUST NOT appear in compiled output
  for any paste host, in any form, under any setting. There MUST be no option,
  confirmation or flag that causes it to.
- **FR-080**: Where a picture held on the device is omitted from output for a
  paste host, the seller MUST be warned, the warning MUST name the picture, and
  it MUST say where the picture does appear. It MUST NOT be dropped in silence.
- **FR-081**: Nothing in compiled output for a paste host may disclose that a
  picture on the device exists, nor its identifier, nor its original filename.
- **FR-082**: The seller MUST be told where a picture from their device will and
  will not appear BEFORE they choose one, not only afterwards.
- **FR-083**: Location and camera information carried inside a photograph MUST
  NOT be retained when it is stored.
- **FR-084**: Before accepting a picture, the app MUST establish that there is
  room for it, and MUST refuse with a specific message stating what is in use
  and what the seller can do, rather than a generic failure. Constitution
  Principle V.
- **FR-085**: If storage fills during a save, the message MUST name what failed,
  MUST state that the seller's page is not lost, and MUST NOT be the generic
  failure text. Constitution Principle V.
- **FR-086**: The app MUST ask the browser to treat this storage as persistent,
  and MUST continue to work normally when that request is refused.
- **FR-087**: Sellers MUST be able to see what their pictures cost in storage
  and remove ones they choose. Nothing MUST remove a picture automatically, for
  any reason, including recovering space. Constitution Principle V.
- **FR-088**: A page pointing at a picture that is no longer stored MUST still
  open and still produce a menu file, and MUST report the missing picture by
  name rather than rendering a broken image.
- **FR-089**: The stored page format MUST carry pictures on the device as
  identifiers, never as addresses, so that no code path can mistake one for
  something publishable.
- **FR-090**: A page written by an earlier version MUST open unchanged, and MUST
  NOT acquire any new field it did not have. An absent optional field MUST NOT
  be created with an empty value.

**Finding the price breakdown**

- **FR-091**: The control that produces quantity breakdowns MUST be named and
  hinted for what it does to the published page, rather than for the pricing
  concept behind it.
- **FR-092**: A blank price row MUST continue to ask for exactly two things.
  This requirement exists to stop FR-091 being satisfied by promoting the field
  out of its fold.

### Key Entities

- **Menu file**: A single saved document representing the seller's page as a
  reader sees it. Carries its own presentation and, where possible, its own
  pictures. Not a host, not something anyone pastes anywhere, and not editable
  back into the app.
- **Picture on the device**: An image the seller chose from their own device,
  stored on that device, referred to by the page through an identifier. Appears
  in the menu file. Never appears in anything published.
- **The saved file host**: The set of rules describing what the menu file can
  display, held in the same form as the rules for each paste host, so that the
  difference between the two is a value rather than a special case in code.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A seller can go from an open page to a menu file sent to somebody
  in under 30 seconds, using only their phone, with no connection.
- **SC-002**: A saved menu file opens correctly with no network access, and its
  rendering matches what the app previewed for it.
- **SC-003**: Across every input the project's hostile text corpus contains, no
  saved menu file contains anything executable. Verified by producing the files,
  not by inspecting the code that makes them.
- **SC-004**: A picture held on the device appears in zero compiled outputs for
  paste hosts, across every host and every combination of fields a price row
  allows. Verified by injecting a failure and watching the check catch it, not
  by observing that a check passes.
- **SC-005**: A seller who fills their storage sees a message naming the
  problem, the amount in use, and a next step, and still has their page.
- **SC-006**: A seller shown the price row form for the first time can find
  where to enter "1 lb for 7, 5 lb for 30" without being told where it is.
- **SC-007**: A menu file renders without sideways page scrolling at 390 CSS
  pixels wide, the width the project already measures against.
- **SC-008**: Every page that opened before this feature still opens after it,
  byte for byte identical when saved back unchanged.

## Assumptions

- **The seller sends the file themselves.** The app hands the file to whatever
  the device offers for sending. The app is not a mail client and does not
  transmit anything.
- **The recipient has a browser.** Every phone and computer does. Nothing is
  installed and no account is involved.
- **A menu file is read, not edited.** It is a one way output. Reopening one in
  the app is not offered, and the existing backup file remains the way to move a
  page between devices.
- **Print is out of scope.** A page laid out for printing is a different
  document with different constraints, and nobody asked for one.
- **Pictures from the device are for the file, not for hosting.** The existing
  path that puts a picture at a web address is unchanged and remains how a
  picture reaches a published page.
- **Sizes are governed by what the device offers.** The app reuses the downscale
  it already applies before uploading, so a picture costs roughly what it
  already costs, and no new size policy is invented.
- **Existing pages carry no pictures on the device**, so every page in existence
  today produces the same paste output after this feature as before it. This is
  assumed and is asserted by SC-008 rather than trusted.
