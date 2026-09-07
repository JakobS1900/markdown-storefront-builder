# Feature Specification: The pages sidebar

**Feature Branch**: `025-pages-sidebar`
**Created**: 2026-09-07
**Status**: Draft
**Input**: User description: "A sidebar for pages: open, switch between and manage saved pages, as a drawer on a phone and pinned beside the editor on a wide screen"

## Where this came from

Jakob, on 2026-09-07, after using the app:

> When I go to your pages, I feel like it would be nicer to have a sidebar that
> I can open right now to get to those things. And on that sidebar, I want to be
> able to open and go through all of my pages, and I want my pages saved.

Two things in that are already true and one is not. Pages **are** saved, in this
browser, and they always have been. What is missing is a way to move between
them that feels like moving between them: today the list is a folded disclosure
at the top of the Build surface, above the page you are editing, and reaching
another page means scrolling to the top of your own work and unfolding a group.

The list is also in the wrong place conceptually. It is not part of the page you
are building. It is the thing you use to choose which page you are building.

## What this is not

**Not the wizard.** Starting a new page is on this surface, and what that button
DOES is feature 027's business. This feature moves the door; it does not change
what is behind it.

**Not a new storage model.** Pages already persist. Nothing here changes how or
when they are written.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Move between pages without losing your place (Priority: P1)

A seller has three pages: their market stall, a commission list, and something
half finished. They are editing one and want another. They open the sidebar,
see all three, tap one, and it opens. The sidebar closes behind them and they
are looking at the page they asked for.

**Why this priority**: It is the request, and it is the only story that is
worth anything on its own.

**Independent Test**: With three saved pages, open the sidebar from anywhere in
the app, tap a different page, and confirm it opens and the sidebar closes.

**Acceptance Scenarios**:

1. **Given** more than one saved page, **When** the seller opens the sidebar,
   **Then** every page is listed, newest first, with the open one marked as
   current rather than offered as a destination.
2. **Given** the sidebar is open, **When** the seller chooses another page,
   **Then** it opens, the sidebar closes, and they are told which page they are
   now on.
3. **Given** the sidebar is open, **When** the seller changes their mind,
   **Then** they can close it without choosing anything, and nothing has
   changed.
4. **Given** a page is being opened, **When** it has not finished, **Then** the
   app says so rather than appearing to have ignored the tap.

---

### User Story 2 - Reach it from anywhere, on the device you actually use (Priority: P1)

The seller is on the Copy tab and wants a different page. They do not have to go
back to Build first.

**Why this priority**: Same priority as story 1 because a page switcher that
exists on one of three surfaces is a page switcher somebody has to remember the
location of. That is the problem this feature exists to remove, not a polish
item on top of it.

**Independent Test**: Open the sidebar from Build, from Preview and from Copy.

**Acceptance Scenarios**:

1. **Given** any surface, **When** the seller looks for their pages, **Then**
   the same control is in the same place.
2. **Given** a phone, **When** the sidebar is open, **Then** it is over the page
   rather than squeezing it, and the way to dismiss it is obvious.
3. **Given** a screen with room for both, **When** the app is opened, **Then**
   the sidebar is simply there beside the editor and does not need opening at
   all.

---

### User Story 3 - Manage the pages, not just visit them (Priority: P2)

Starting a new page, starting from a template, and removing a page you have
finished with all belong with the list of pages rather than inside one of them.

**Why this priority**: It is the tidying that makes the sidebar worth having
rather than a second place to look. Second because story 1 delivers on its own
and this improves it.

**Independent Test**: Start a new page from the sidebar, and remove one, without
visiting the Build surface first.

**Acceptance Scenarios**:

1. **Given** the sidebar, **When** the seller wants a new page, **Then** they
   can start one from there, blank or from a template.
2. **Given** the sidebar, **When** the seller removes a page, **Then** they are
   asked first, by name, and the safe answer is the easy one.
3. **Given** the page currently open, **When** the seller looks at the list,
   **Then** it cannot be removed from under them without first being left.

---

### Edge Cases

- **No saved pages at all.** A new arrival has one unsaved page and nothing to
  switch to. The sidebar must not be an empty box; it is where starting
  something belongs.
- **One page.** There is nothing to switch to, but starting a second one is
  exactly what somebody with one page might want.
- **Many pages.** The list scrolls on its own, without the page behind it
  scrolling too.
- **A page that will not open**, because it was saved by a newer version or is
  damaged. The existing recovery path must still be reachable and must not be
  hidden behind a closing drawer.
- **The keyboard is open on a phone** when the sidebar is opened.
- **The window is resized across the breakpoint** while the drawer is open.
- **The system back gesture** while the drawer is open: it should close the
  drawer, not leave the app.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-093**: Sellers MUST be able to open a list of every page saved in this
  browser from any surface of the app, using one control in one place.
- **FR-094**: The list MUST show every saved page, newest first, and MUST mark
  the page currently open rather than offering it as somewhere to go.
- **FR-095**: Choosing a page MUST open it, MUST close the list on a phone, and
  MUST tell the seller which page they are now on.
- **FR-096**: The seller MUST be able to dismiss the list without choosing
  anything, and dismissing it MUST change nothing.
- **FR-097**: On a screen with room, the list MUST be present beside the editor
  without needing to be opened, and MUST NOT overlay the page.
- **FR-098**: On a narrow screen the list MUST overlay rather than compress the
  page, and MUST NOT leave the editor partly visible and partly reachable.
- **FR-099**: While the list is open on a narrow screen, the content behind it
  MUST NOT be operable, and focus MUST NOT be able to leave the list by
  keyboard.
- **FR-100**: The system back gesture, and the keyboard's escape, MUST close the
  list rather than leaving the surface or the app.
- **FR-101**: Starting a new page, and starting from a template, MUST be
  available from the list.
- **FR-102**: Removing a page MUST ask first, MUST name the page in the question
  and in both answers, and the answer that keeps the page MUST be the prominent
  one.
- **FR-103**: The page currently open MUST NOT be removable without leaving it
  first.
- **FR-104**: Opening a page MUST report that it is under way, for the same
  reason and by the same means as opening a template already does.
- **FR-105**: The list MUST scroll independently of the page behind it, and
  reaching the end of the list MUST NOT scroll the page.
- **FR-106**: The page list MUST NOT appear twice. Where it exists today, inside
  the Build surface, it MUST be removed rather than duplicated.
- **FR-107**: No change here may alter when or how a page is saved.

### Key Entities

- **The pages list**: the set of pages saved in this browser, already held in
  application state and refreshed at the moments the set can change. This
  feature presents it; it does not change how it is gathered.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-009**: A seller on any surface can reach another of their pages in two
  actions: open the list, choose the page.
- **SC-010**: On a 390 pixel wide screen, opening the list does not move,
  resize, or horizontally scroll the page behind it.
- **SC-011**: With the list open on a narrow screen, no control behind it can be
  reached by keyboard, and closing it returns focus to the control that opened
  it.
- **SC-012**: On a screen 900 pixels wide or more, the list is visible without
  any action, and the editor keeps a readable column.
- **SC-013**: The interface has no second copy of the page list. Removing a page
  or starting one behaves identically wherever it is done, because it is only
  done in one place.
- **SC-014**: Typing in the editor is no slower than before this feature, on the
  reference handset.

## Assumptions

- **Pages already persist and that is not in question.** The request mentioned
  wanting pages saved; they are, and have been since the app shell was built.
  Nothing here changes it, and SC-014 exists to make sure nothing here makes it
  worse.
- **The tab bar stays.** Build, Preview and Copy are surfaces of one page; the
  sidebar is about which page. Folding one into the other was considered and
  rejected in the planning conversation: the tab bar's position was measured and
  costed at 117 pixels and the accessibility gate asserts its shape.
- **Starting a new page is a door, not a destination.** Feature 027 will change
  what happens when it is pressed. This feature only decides where it lives.
- **The reference screen is 390 by 844**, the handset every layout decision in
  this project has been measured against.
