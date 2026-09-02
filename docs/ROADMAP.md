# Roadmap

Each item is sized for one pipeline cycle: specify, plan, tasks, analyze,
implement, review, verify. Items are numbered and ordered. Nothing here is
started until the item above it is landed.

## Stack decision

TypeScript throughout, Vite for the app build, Vitest for tests, `tsc` in strict
mode, ESLint with the dangerous categories promoted to errors.

Rationale, and the tension worth naming: the existing portfolio is deliberately
build-free, and that was right for a static site. This project cannot be. It
needs a typed engine with golden-file tests, a service worker, and a bundled
PWA. Vite plus Vitest is the smallest toolchain that provides those without
adding a framework. The engine itself still has zero runtime dependencies, which
is the constraint that actually matters.

If Jakob prefers a different runner or bundler, this is the cheapest moment to
change it.

## Phase 0: Foundation

- [x] **0.1** Git repository and Spec-Kit initialized
- [x] **0.2** Project rules in `CLAUDE.md`
- [x] **0.3** Design validated and recorded
- [x] **0.4** First-pass host verification, target set decided
- [x] **0.5** Constitution ratified v1.0.0
- [x] **0.6** Roadmap and workflow docs (this file and `docs/WORKFLOW.md`)
- [x] **0.7** Toolchain bootstrapped and proved: build, test, lint, a11y, secret
      scan, and a trivial end to end skeleton that compiles an empty document
      and runs clean

## Phase 1: The engine

- [x] **1.1 The `Document` contract.** The versioned schema, its validator, and
      its name/type/order parity test. Lands FIRST and ALONE per the
      constitution, in its own commit, before anything consumes it. Includes the
      lossless JSON round-trip test.
- [x] **1.2 The compile skeleton and golden harness.** `compile(doc, targetId)`
      returning markdown plus diagnostics, the target record type, both target
      records (`rentry` and `portable`), the byte-comparing golden fixture
      harness, and the determinism property test. Carries one decision already
      made in review R-4: an unknown target falls back to `portable` and raises a
      diagnostic naming it. Emitters for the two trivial
      blocks only, `heading` and `divider`, so the whole pipeline is proved end
      to end on the smallest possible surface.
- [x] **1.3 The `prose` emitter.** Paragraphs of plain text, escaped so
      nothing an artist writes can become structure. The formatting deferred
      from here landed in 1.7.
- [x] **1.7 Inline formatting in prose.** Bold, italic, lists, and links inside
      a text section. Deferred out of 1.3 because the contract stores
      `prose.text` as one string and the compiler escapes every Markdown
      character, so a subset grammar needs either a parser with a whitelist or a
      change to the contract's shape. Both are real decisions that deserve a
      cycle rather than being smuggled into an emitter.
- [x] **1.4 The `menu` emitter and table degradation.** Tiers, pricing, add-ons.
      The first capability that genuinely diverges between targets, so the
      fallback path and the diagnostics it emits are proved here.
- [x] **1.5 The `gallery` emitter and image capabilities.** Grid, list, and
      single layouts. rentry image sizing versus the portable baseline, which is
      the clearest demonstration of why the compiler exists.
- [x] **1.6 The `profile` emitter.** Avatar, name, tagline, status, links,
      payment methods.

## Phase 2: The app

- [x] **2.1 App shell and persistence.** The three surfaces, routing, IndexedDB
      storage, export and import, and the schema migration path. Carries FR-018
      from feature 001: a page that fails to load MUST still be retrievable as
      its raw stored content, and the failure message MUST offer that action.
      Raised by review R-4, because refusing to open a page is only recoverable
      if the artist can still get their work out.

      **Import was ticked here and did not exist.** Export shipped, and with it
      a button offering "a backup you can reopen here", but there was no file
      input anywhere in the app and nothing that read one. The item stayed
      ticked from 2026-08-15 until 2026-08-31, when opening a backup was
      actually built, in commit `911d758`. Found by checking the three surfaces
      on a phone rather than by reading this line, which is the point: a ticked
      box is a claim, and this one was wrong for sixteen days.
- [x] **2.2 The block editor.** Add, edit, reorder, and delete blocks. Mobile
      sheet and desktop card forms. Accessibility gates enforced from the first
      control, not retrofitted.
- [x] **2.3 Preview and diagnostics.** Rendering compiled output through the
      sanitizer, surfacing lint results against the offending block, and the
      target switcher. Carries the preview sanitizer and its XSS corpus, which
      were originally scoped to 1.3 and moved here because a sanitizer with no
      preview to protect is a capability with no consumer. The emitted-text
      escaper, which protects the artist's page on the host, shipped in 002 and
      003 and is a different gate.
- [x] **2.4 Export and handoff.** Copy, download, and the host-specific paste
      walkthrough.
- [x] **2.5 PWA.** Service worker, offline app shell, installability.

## Phase 3: Images

- [x] **3.1 URL image entry.** Validation, preview, and broken-link detection.
      Ships before upload so the gallery is usable with no server at all.
- [x] **3.2 The upload proxy.** The serverless function, magic-byte sniffing,
      byte ceiling, per-IP rate limiting, and the server-held key.

      **Shipped, then deliberately removed** in `7b391bc`, and the published
      build now carries no upload key at all (`c79e5a9`). A serverless function
      is a deployment, a runtime, and a thing that can be down, in a project
      whose pitch is that it needs no server. The reasoning is in
      `specs/006-images/spec.md`. This item is left ticked because it was built
      and the decision to drop it was made with it working, but nothing in the
      repository implements a proxy today, so do not go looking for one.
- [x] **3.3 Client upload path.** Canvas downscale and re-encode, the upload UI,
      and graceful degradation to URL mode when the proxy is unavailable. The
      downscale and the UI are real and still tested; uploads now go directly to
      the host, and are absent from the published build for want of a key.

## Phase 4: Ship

- [x] **4.1 CI.** Build, test, lint, a11y, and secret scan as required checks.
- [x] **4.2 Manual host verification pass.** Fixtures pasted into the live hosts
      and compared, per the checklist. Not automatable, and not skippable.
- [x] **4.3 Deploy.** Static app and the proxy.
- [x] **4.4 The case study.** The portfolio write-up. The engine and its golden
      tests are public and readable, which is the entire point of building it
      this way.

## Phase 5: The phone

Added on 2026-08-31, describing work already done. This phase was missing
entirely: the decision to wrap the app natively came after the roadmap was
written, so the document that says everything is finished was silent about the
platform the owner actually uses. Every item below shipped before it was
written down here, which is the wrong order and is recorded rather than tidied
away. 5.7 is the exception and the first thing in this project since the engine
to be specified before it was built.

It is also where work found by using the app on the phone is recorded, whether
or not the fix is specific to the phone. 5.7 is not a native concern at all: it
was found on the device, which is where everything is found now.

- [x] **5.1 The native shell.** A Capacitor wrapper around the same code, with
      no platform branches in the app beyond detecting the shell. It buys a
      launcher icon and a real file picker; the web build was already offline
      and local, so there was nothing else for a native layer to add.
- [x] **5.2 The service worker comes out.** It earns its place on the web and is
      a liability inside the package, where it shadowed the app's own files with
      the previous build. The native build tears down any registration and cache
      a previous version left behind.
- [x] **5.3 Room to type.** The keyboard was taking the screen away twice, once
      by the window resizing and once by Capacitor padding for the same inset,
      leaving 114 of 672 CSS pixels. The page no longer asks for the treatment
      that triggers it.
- [x] **5.4 Files that exist.** An anchor with a download attribute does nothing
      in a WebView, so both export buttons produced no file while announcing
      that they had. The shell writes into its own directory and offers the file
      through the manifest's file provider, and the page reports what actually
      happened.
- [x] **5.5 Back goes back.** Back closed the app from every screen. It now
      returns to Build from anywhere else and leaves from Build, with at most
      one history entry so wandering between tabs never deepens the stack.
- [x] **5.6 On-device verification.** Driven over adb against the WebView's own
      debugger: persistence across a kill, the clipboard, typing at speed, the
      export files, and the whole editing loop. Recorded in `63ccbec` and in
      `specs/010-field-work/spec.md`.
- [x] **5.7 Pages you can reach, make, and put away.** Storage held many pages
      from the start and nothing ever let anyone choose one, so the app opened
      the newest and every other page was unreachable. Importing a backup makes
      a page, and a page refused under FR-018 keeps the newest timestamp, so
      both of them stranded the artist's real work in storage where they could
      not get at it. "Your pages" on the Build screen opens any of them,
      including after a refusal, which is the case it exists for
      (`specs/011-page-list/spec.md`).

      Shipping that made the rest of the hole obvious: the only way to create a
      page was to import a file, `newPage` had sat in `store.ts` with no caller
      since the app shell, and nothing could ever be removed. Starting and
      removing a page landed next (`specs/012-page-lifecycle/spec.md`), with the
      rule that the page on screen cannot be removed, enforced in the store and
      not only by declining to draw the control. Both were specified before they
      were built and walked on the device with real taps.
- [x] **5.8 A signed release.** A release build, signed with an RSA 4096 key
      held outside the repository and valid to 2054, verified against both the
      v2 and v3 signature schemes. v3 is on deliberately: it carries a rotation
      lineage, which is the only thing that would let a leaked key be replaced
      instead of ending the app. Without the key present the build still
      succeeds and produces an unsigned file, so a fresh clone and CI both
      compile the release variant; confirmed by pointing the build at a key file
      that does not exist. Procedure and the recovery position are in
      `docs/RELEASE.md`.

      **Distribution is GitHub Releases, deliberately.** The signed APK is
      attached to a tagged release and the web version needs no install at all.
      There will be no Play listing: Google charges a registration fee to
      publish, and this is a free app. The cost is real and is recorded in
      `docs/RELEASE.md` rather than glossed over: no store search, no automatic
      updates, and a one time "allow from this source" prompt for anyone
      installing the APK.
- [x] **5.9 A second device.** Done 2026-09-01, on a Google Pixel, and it paid
      for itself immediately. The APK installed and ran, and the owner found a
      defect the Moto G7 had never shown: single characters going missing while
      typing, and whole words wrong when swiping. Both were the same repaint
      racing the keyboard, and the swipe case was the same bug made certain
      rather than a second one.

      The device harness could not reproduce it, because `adb shell input text`
      injects committed text and skips the composing buffer the bug lived in: it
      typed ten characters out of ten on the broken build. That is recorded
      because it is the limit of the harness, not a detail about one bug.

- [x] **5.10 A third host.** text.is, added 2026-09-01 under Principle II, which
      is why it cost a data record and no emitter change. Every capability was
      observed on the host's own renderer and written up in
      `docs/research/2026-09-01-textis-verification.md`.

      It also corrected a value nobody had checked. The portable baseline had
      used the CommonMark backslash hard break since the beginning, and
      verifying a third host proved it works on none of the three: rentry
      swallows it and text.is destroys it, consuming the newline and the joining
      space. The target named "works anywhere" now emits the form that does.

      ghostbin and pastebin were investigated and refused, and the reasons are
      in `specs/018-more-hosts/spec.md`. Neither is a scope decision: ghostbin
      returns 502 on every publish so its behaviour cannot be observed, and
      pastebin puts Markdown behind a paid tier.

## Phase 6: Starting points

Added on 2026-09-02, the same day it shipped, and not on this document before
that: like phase 5, the roadmap was silent about work until after it existed.
Three ideas raised that day, import, a template wizard, and bulk pricing maths,
turned out to decompose into four features once written down. This phase is the
first of the four and the only one that depends on nothing else built yet. F2,
F3, and F4 are not started. F2 needs its own spec before any of it is built,
for the reasons recorded in `specs/021-starting-points/spec.md` under "What
this is part of".

- [x] **6.1 Eight starting points.** A picker offering eight seller shapes in
      place of the single hardcoded example, each a page that parses, validates,
      and compiles with zero diagnostics on every target. Reached from both
      places a new page is started: `Your pages`, and the empty state a first
      visitor sees. The example page that ships is now checked by the same gate
      (`specs/021-starting-points/spec.md`, `app/tests/starters.test.ts`).

## Explicitly deferred

Accounts, cloud sync, direct publish via host APIs, custom output CSS,
collaboration, a templates marketplace, and internationalization. Introducing
any of these requires a constitution amendment.

**This list used to end "plain-text bin targets, and any third host", and that
was wrong on 2026-09-01 when text.is shipped.** It was wrong when it was
written, too, and the correction is worth more than the edit.

The constitution's out of scope list names seven things and none of them is a
host. Principle II says the opposite: a host is a target record plus golden
fixtures, adding one MUST NOT require an engine change, and a change that adds
a host while editing an emitter is a design failure. So hosts were always meant
to be cheap, and this document had quietly promoted a roadmap preference into a
constitutional limit that did not exist.

Checked rather than assumed when text.is landed: that commit touched
`targets.ts`, an export line, tests and golden files, and no emitter. Principle
II holds. What needed correcting was this paragraph.
