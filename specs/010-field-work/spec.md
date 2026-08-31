# Feature Specification: Field Work

**Feature Branch**: none. Twenty two commits straight onto master, `63ccbec` to `3ca3b2f`.
**Shipped**: continuously, 2026-08-25 to 2026-08-31.
**Status**: Ongoing. Specified retrospectively on 2026-08-31, see `specs/README.md`.
**Input**: No spec preceded this. It began when the owner used the app and reported it unusable, and continued as using it kept finding things.

## What this feature is

Everything found by holding the thing rather than reading it. It has no branch
and no plan because it was not planned: each item was found by use, diagnosed,
fixed, and verified on the device or in a real browser, one at a time.

It is recorded as a feature because twenty two commits of behaviour change is a
feature whatever the branch name says, and because the pattern in it is worth
more than any individual fix.

## The pattern

Every defect here shares a shape: **the tests passed and the app was wrong**, and
in most cases the test could not have failed.

- Every test set a field's value in one assignment and fired one event. A person
  does not do that. The worst defect in the project lived entirely in the second
  keystroke, so the method was shaped so that a second keystroke never happened.
- The accessibility gate reported green on a control it had never rendered.
- The preview renderer had no test at all while claiming one in its own comment.
- The stylesheet and the shell both described a split view that did not exist.
- The persistence layer, the module the constitution cares most about, was
  verified only by hand.

A green gate that cannot express the failure is not evidence. Three of the fixes
below were caused by an earlier fix in this same list, which is the argument for
going back repeatedly rather than once.

## What was found and fixed

Ordered by when, with the commit that fixed each.

1. **Typing one character closed the keyboard** (`e47de58`). The interface
   rebuilt its whole DOM on every state change, and a keystroke is a state
   change, so the focused element was destroyed on every letter; field ids
   climbed forever, so nothing could find the field again. One rebuild cost 37ms
   and every character caused two, so roughly 75ms of blocked main thread per
   key, and the WebView discarded anything typed at speed. Reported by the owner,
   minutes into using it.
2. **The price list did not feel like adding an item** (`ebcc66a`). It opened on
   two optional settings and a button, and asked you to press "Add an option"
   before anything you could sell existed.
3. **The keyboard took the screen away twice** (`62791f8`). Capacitor pads the
   WebView's parent by the keyboard height on a branch written for Android 15,
   with no OS version guard, so on Android 10 the keyboard came off twice and the
   usable page collapsed from 672 to 114 CSS pixels.
4. **An empty section was a dead end** (`8e11679`). Seeding new sections was not
   enough: a section with no rows showed no fields at all, which is every section
   saved before that change and every section whose last row is deleted.
5. **Three words for one thing** (`92d9442`). Tier in the output, option in one
   part of the interface, item in another.
6. **A blank table row** (`0ed2ad9`). An item with no name and no price emitted a
   row of empty cells into the artist's page.
7. **Removing a section was instant and irreversible** (`e2e234b`), from a
   control 44 pixels from two harmless ones, on a phone, with no undo.
8. **Empty sections vanished from the preview** with no explanation (`a62f8be`).
9. **The row control said "Edit" whether open or shut** (`bb7706d`), so the
   button offering to edit was the one that took the editor away.
10. **A keystroke dropped when the element was replaced mid-word** (`508de74`).
    Caused by fix 1: deferring repaints exempted shape changes, and typing the
    first character into the placeholder row from fix 4 is a shape change.
11. **Both save buttons did nothing and one said it had** (`ca680d4`). An anchor
    with a download attribute is inert in a WebView. Also: back closed the app
    from every screen.
12. **The preview renderer had no test** (`ea6d898`), while claiming one. The
    design held only because of an escaping rule in another module that nothing
    asserted; breaking that coupling produced seven live `javascript:` addresses.
13. **One field undid the previous one** (`7361a71`). Handlers closed over the
    section as it was at render time, so while repaints waited, a second field
    reinstated the first field's old value. Silent data loss in every form.
    Caused by fix 1.
14. **The desktop layout stranded its own navigation** (`4409f1e`) in the middle
    of the page, with 1088px text inputs.
15. **The split view both files claimed for months** (`777a9b2`) was built.
16. **The persistence layer got tests** (`3ca3b2f`).

## Requirements this establishes

- **FR-010-1**: Typing MUST be tested by typing. A test that sets a value in one
  assignment does not exercise the editor.
- **FR-010-2**: A repaint MUST NOT replace the element that currently has the
  caret, and MUST NOT be scheduled while a field has focus.
- **FR-010-3**: A handler MUST act on the document as it is when it runs, never
  on a copy captured when the form was drawn.
- **FR-010-4**: Removing a section MUST be confirmed.
- **FR-010-5**: A control MUST say which way it will go.
- **FR-010-6**: The app MUST NOT report success it has not verified. A native
  bridge that returns an error, or throws, is a failure and must be said so.
- **FR-010-7**: Any address that reaches an `href` or a `src` MUST be checked
  where it is used, not only where it was produced.

## Success Criteria

- **SC-010-1**: Typing "Full colour bust" at full speed on the device loses
  nothing, in eight runs out of eight. Before the fix, three in eight lost a
  character.
- **SC-010-2**: The usable page is 417 CSS pixels with the keyboard up, not 114.
- **SC-010-3**: Keystroke cost is 1.9ms, once per key, not 37ms twice.
- **SC-010-4**: Both save buttons produce a file on disk and offer it to the
  share sheet.
- **SC-010-5**: Back returns to Build from Preview and Copy, and leaves the app
  from Build.
- **SC-010-6**: 623 tests, an accessibility gate that has been made to fail on
  purpose, and a dash scan.

## What is still open

- The header puts the title hard left and the target selector hard right at wide
  widths, which reads as disconnected. Cosmetic, untouched.
- `docs/ROADMAP.md` does not mention Android at all.
- This work has no architecture or holistic review, in common with everything
  since feature 003.

## Dependencies

Features 004 to 009, and a physical phone.
