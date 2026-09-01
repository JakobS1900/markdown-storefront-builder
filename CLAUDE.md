<!-- SPECKIT START -->
Start at `specs/README.md`. It indexes every feature, says which documents
each one actually has, and is honest about which were written after the code
shipped. For technologies, project structure, and shell commands, read
`docs/ROADMAP.md` and `docs/WORKFLOW.md`.

This block used to name `specs/002-compile-skeleton/plan.md` as "the current
plan". It had been finished for a month, so every session began by reading a
description of work already done. Specs 004 to 010 were backfilled on
2026-08-31 and say so in their own headers; there are no plan or task
documents after 001, and no architecture or holistic review after 003.
<!-- SPECKIT END -->

# Project Rules

These rules OVERRIDE tool defaults, plugin templates, and any generated
boilerplate. When a tool wants to do something this file forbids, this file
wins.

## Non-negotiables

1. **No AI attribution in commits, ever.** No co-author trailer, no "generated
   with", no mention of an AI anywhere in a commit message, PR body, or
   changelog. The `/ship` template will try to add one. Override it.
2. **No em dashes and no en dashes anywhere.** Code, comments, commit messages,
   docs, specs, UI copy. Use a comma, a colon, or a full stop.
3. **Push policy: commit locally, never push.** Creating or pushing to a remote
   is Jakob's call, made explicitly, each time. Default to local commits and
   hand off.
4. **All hooks pass. Never use `--no-verify`.** If a hook fails, fix the cause.
5. **"Done" means verified with evidence.** Run the command, read the output,
   quote it. "Should work" is not done.

## Commit identity

`JakobS1900 <jakob.stanfield@ras-software.com>`. Already set in git config. Do
not use `admin@topplelabs.com`, which is not Jakob's address.

## Skill routing

Feature work routes into the SpecKit + Superpowers pipeline, not ad-hoc answers:

| Intent | Route to |
|---|---|
| New feature or subsystem | `/speckit-specify` then `-plan`, `-tasks`, `-analyze` |
| Implementation of a planned feature | Superpowers subagent-driven-development, chunked |
| Any bug, test failure, or surprise | Superpowers systematic-debugging first |
| Writing any logic | Superpowers test-driven-development, failing test first |
| Claiming something is complete | Superpowers verification-before-completion |

gstack review gates (`plan-eng-review`, `review`, `qa`, `ship`, `cso`) are
installed at `C:/Users/Emu/.claude/skills/` but are NOT reachable from sessions
whose config dir is `.claude-personal/`. They are deferred by decision, to be
added later. Until then, treat `plan-eng-review` as a gap we are knowingly
carrying, not as a step that was unnecessary.

## Implementation rules carried from prior projects

- **The cross-boundary contract lands FIRST, alone, with a parity test.** In
  this project that is the `Document` JSON schema, which crosses the engine, the
  app, IndexedDB, and the export file. Grow it in its own
  isolated chunk guarded by a name, type, and order parity test.
- **Chunk the implementation.** Group tasks into coherent chunks aligned to
  phases. One fresh implementer subagent per chunk, then a fresh spec-compliance
  reviewer, then a fresh code-quality reviewer. Do not dispatch one subagent per
  task.
- **After all chunks, run one holistic review over the whole feature diff.**
  Per-chunk reviews each see one internally correct side of a seam and
  structurally cannot catch cross-cutting bugs. Required for any feature over
  roughly three chunks.
- **Track review carry-forwards as `CHUNK N:` code comments**, not prose. Prose
  gets lost across subagent boundaries.
- **Fix-first on review findings.** Auto-apply mechanical fixes. Batch genuine
  decisions into one question.
- **Never delete Jakob's work or a user's saved document to recover from a
  failure.** Keep it and report honestly.

## Operational snags

- `specify` crashes with `UnicodeEncodeError` drawing its banner unless
  `PYTHONIOENCODING=utf-8` is exported first.
- Spec-Kit scripts here are PowerShell (`.specify/scripts/powershell`).
- **Do NOT append to files with `cat >>` through the Bash tool.** It corrupted
  two files here, `app/src/styles.css` and `app/tests/a11y.test.ts`, in both
  cases writing partway through the file and destroying what was already there.
  Use the Write or Edit tools instead. The same applies to multi-line `node -e`
  string surgery: backticks and template literals do not survive the shell.
- **`Select-Object -First N` corrupts the exit code you are reading.** Piping a
  command through it terminates the pipeline early, and PowerShell reports that
  as a non-zero exit (seen as 255). A gate can print entirely green and still
  appear to have failed. Check a gate's real status by running it alone, not
  through a truncating pipe. Diagnosed 2026-08-15 after `npm run verify` seemed
  to fail while every one of its steps passed.
- **A screenshot of a sleeping phone is a white PNG, not a broken app.** On
  2026-09-01 three identical 9,652 byte white screenshots were read as the app
  failing to render, and a rebuild, a reinstall and a service worker
  investigation followed. The app had been fine the whole time: `dumpsys power`
  said `mWakefulness=Dozing`, because the screen had timed out during the ten
  minutes of building. Check wakefulness IMMEDIATELY BEFORE each `screencap`,
  not once at the start of the run, and treat a screenshot under about 20 kB as
  a sleeping screen until proven otherwise. `adb shell svc power stayon usb`
  holds it awake while plugged in; set it back to `false` afterwards, because it
  is the owner's device setting and not ours.
- **Gradle needs JDK 21 here, and `JAVA_HOME` points at JDK 8.** The Android
  build fails with "Dependency requires at least JVM runtime version 11" and,
  with JDK 17, "invalid source release: 21". Set
  `$env:JAVA_HOME="C:\Program Files\Java\jdk-21"` for the build only, rather
  than changing the machine's global setting.
- **`MSYS_NO_PATHCONV=1` applies to `adb shell` too, not just `adb pull`.**
  Without it `screencap -p /sdcard/x.png` is rewritten to a Windows path and
  prints its usage text instead of capturing anything.
- **`npm install` MUST be run from PowerShell, not the Bash tool.** Under msys2
  Git Bash it fails with `ERR_INVALID_ARG_TYPE` plus `EPERM` cleanup errors,
  because it picks up the msys2 npm cache. The same command succeeds in
  PowerShell. Run all npm commands there.

## Verification gate

`npm run verify` runs typecheck, lint, test, secret scan, and the a11y gate in
that order. Run it from PowerShell. It is what "done" means.

The a11y gate is REAL as of feature 004. `npm run a11y` runs axe-core over the
rendered shell under jsdom, plus assertions covering what a machine cannot
check: that every control has an accessible name rather than a plausible
looking one, that no placeholder stands in for a label, and that the touch
target minimum is in the stylesheet. Verified firing on 2026-08-15 by stripping
the aria-label from icon buttons.

Colour contrast is disabled in THAT gate, because jsdom does not lay anything
out and asserting it there would produce a number that means nothing. It used
to be the file's one honest gap, covered only by a manual pass nobody could
rerun.

`npm run contrast` closes it, and runs as part of `npm run verify`. Headless
Chrome, the built app, axe with only the contrast rule, run twice: once with
`prefers-color-scheme: light` and once with `dark`, because both palettes ship
and testing one is testing half the users.

It measures the bundled example storefront with a section opened, not the empty
shell, and it refuses to report a pass unless at least three sections and three
fields were actually on screen. A gate that measured an empty page would be
green and worthless, which is a mistake this project has already made three
times in one afternoon.

Verified firing on 2026-09-01 by weakening `--muted` in the light palette: it
reported two failures at ratios of 1.52 and 1.58 against an expected 4.5, named
the exact colours, and left the dark palette correctly passing.

Constitution Principle I is enforced by ESLint, not by review:
`engine/src/**` cannot reference `document`, `window`, `fetch`, `Date.now`,
`Math.random`, or `new Date`. Verified firing on 2026-08-15.

<!-- ACTIVE FEATURE: none. Phase 2 complete. -->

## Bootstrap status

- [x] Git repository initialized
- [x] Spec-Kit initialized (`specify` 0.7.5.dev0, claude integration, ps scripts)
- [x] Project rules written
- [x] Constitution ratified v1.0.0 (`.specify/memory/constitution.md`)
- [x] Roadmap and workflow docs written (`docs/ROADMAP.md`, `docs/WORKFLOW.md`)
- [x] Toolchain bootstrapped: build, test, lint, a11y, secret scan
- [x] Empty end-to-end skeleton builds, tests, and runs clean
- [x] Phase 0 committed
