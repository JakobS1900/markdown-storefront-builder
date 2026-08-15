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

- [ ] **1.1 The `Document` contract.** The versioned schema, its validator, and
      its name/type/order parity test. Lands FIRST and ALONE per the
      constitution, in its own commit, before anything consumes it. Includes the
      lossless JSON round-trip test.
- [ ] **1.2 The compile skeleton and golden harness.** `compile(doc, targetId)`
      returning markdown plus diagnostics, the target record type, both target
      records (`rentry` and `portable`), the byte-comparing golden fixture
      harness, and the determinism property test. Emitters for the two trivial
      blocks only, `heading` and `divider`, so the whole pipeline is proved end
      to end on the smallest possible surface.
- [ ] **1.3 The `prose` emitter and the narrow gate.** Bold, italic, lists,
      links, nothing else. Normalization and escaping. The sanitizer and its XSS
      corpus test. This is the first block carrying real user text, so the gate
      lands with it.
- [ ] **1.4 The `menu` emitter and table degradation.** Tiers, pricing, add-ons.
      The first capability that genuinely diverges between targets, so the
      fallback path and the diagnostics it emits are proved here.
- [ ] **1.5 The `gallery` emitter and image capabilities.** Grid, list, and
      single layouts. rentry image sizing versus the portable baseline, which is
      the clearest demonstration of why the compiler exists.
- [ ] **1.6 The `profile` emitter.** Avatar, name, tagline, status, links,
      payment methods.

## Phase 2: The app

- [ ] **2.1 App shell and persistence.** The three surfaces, routing, IndexedDB
      storage, export and import, and the schema migration path.
- [ ] **2.2 The block editor.** Add, edit, reorder, and delete blocks. Mobile
      sheet and desktop card forms. Accessibility gates enforced from the first
      control, not retrofitted.
- [ ] **2.3 Preview and diagnostics.** Rendering compiled output through the
      sanitizer, surfacing lint results against the offending block, and the
      target switcher.
- [ ] **2.4 Export and handoff.** Copy, download, and the host-specific paste
      walkthrough.
- [ ] **2.5 PWA.** Service worker, offline app shell, installability.

## Phase 3: Images

- [ ] **3.1 URL image entry.** Validation, preview, and broken-link detection.
      Ships before upload so the gallery is usable with no server at all.
- [ ] **3.2 The upload proxy.** The serverless function, magic-byte sniffing,
      byte ceiling, per-IP rate limiting, and the server-held key.
- [ ] **3.3 Client upload path.** Canvas downscale and re-encode, the upload UI,
      and graceful degradation to URL mode when the proxy is unavailable.

## Phase 4: Ship

- [ ] **4.1 CI.** Build, test, lint, a11y, and secret scan as required checks.
- [ ] **4.2 Manual host verification pass.** Fixtures pasted into the live hosts
      and compared, per the checklist. Not automatable, and not skippable.
- [ ] **4.3 Deploy.** Static app and the proxy.
- [ ] **4.4 The case study.** The portfolio write-up. The engine and its golden
      tests are public and readable, which is the entire point of building it
      this way.

## Explicitly deferred

Accounts, cloud sync, direct publish via host APIs, custom output CSS,
collaboration, a templates marketplace, internationalization, plain-text bin
targets, and any third host. Introducing any of these requires a constitution
amendment.
