# Handoff

The live document a new session reads first. `CLAUDE.md` still points at
`specs/README.md` for what each feature is; this file is only about what is
happening right now and what to do next.

**Current state**: feature 023, bringing in a price list, is complete, verified
and committed as `fa8eb28` on `master`. Its spec landed separately in `d23881d`.
Working tree clean, nothing pushed, no branch left behind.

## Next up, in order

1. **Run `npm run verify` from PowerShell before anything else.** It is the
   check that tells you whether the tree is actually where this file says it is.
   Expect 1079 tests, a11y 34, contrast clean in both palettes, pwa gate green.
   If it fails, read "Traps" below before believing it: several of its failures
   are environmental rather than real.
2. **F4, the interview wizard, is the last of the four features the 2026-09-02
   ideas decomposed into.** It is explicitly gated, not merely unstarted:
   `specs/021-starting-points/spec.md` says building a question by question
   interview before knowing whether a starting point was enough would be
   guessing. F1 (021 starting points) has now shipped, so **the gate is a
   question for Jakob, not a task**: has anyone used a starting point? Ask
   before specifying F4.
3. **022 bulk pricing still has no holistic review.** It is seven plan sections,
   well over the three chunk threshold `CLAUDE.md` sets, and `specs/README.md`
   marks the column `no`. 023's review found ten defects in four chunks, two of
   which would have shipped a broken feature, so this is not a formality. It is
   the highest value work available that needs nothing from Jakob.
4. **Consider the test suite's timing fragility** (see "Traps"). Not urgent, and
   nobody has asked for it, so do not start it without saying so first.

## Verified live, do not re-probe

- **`npm run verify` passes end to end** as of `fa8eb28`, run alone on a quiet
  machine. 1079 tests in 63 files, a11y 34, contrast 164 elements and 12
  sections in both light and dark with 0 failures, pwa update gate green.
- **Master was green before 023 started.** The baseline run appeared to fail
  with 8 timeouts; every one was load flakiness, confirmed by re-running the
  files alone.
- **023's own repaint fix works.** `price-list-screen.test.ts` has a test that
  focuses the paste box before typing, which is the only state a real seller can
  paste from. It fails without the fix and passes with it.
- **`cost` still never publishes** for any target, including rows created by
  pasting. Asserted by compiling a converted row, not by inspecting the field.

## Traps that cost real time in this session

- **The test suite has genuine timing fragility, and it is not yours.** Several
  tests sit at 3.8 to 4.7 seconds against a 5000ms default timeout:
  `starters-picker`, `page-list`, `page-lifecycle`, `example`, `undo-last`,
  `bulk-apply`, `repaint-while-typing`, `a11y`. Under any parallel load, or with
  a cold transform cache after edits, they time out. A timed-out test also
  pollutes the rest of its own file, which turns one timeout into what look like
  three unrelated assertion failures.
  **Before believing a failure, re-run the file alone.** An A/B/A against a
  `git stash` settled one such scare: the same four files took 100 seconds and
  failed on a cold cache, 22 seconds and passed on pristine master, then 36
  seconds and passed again with the changes restored.
- **Do not run anything else while `npm run verify` is going.** That is what
  made the baseline look broken.
- **The contrast gate can fail without any contrast being wrong.** Its light run
  occasionally does not load the example page, reports `0 sections`, and refuses
  to claim a pass. That is the guard working. Both palettes reported
  `0 contrast failure(s)` while the gate said FAILED. Re-run `npm run contrast`
  alone.
- **`findLastIndex` does not typecheck here.** The project targets ES2022 on
  purpose. Vitest ran it happily on Node, so only `npm run typecheck` caught it.
  Do not raise the project's floor to save four lines.
- **A file named `nul` in the repo root is a Git Bash redirect accident**, but
  check before deleting: the one found this session was a valid 248 KB GIF. It
  was copied to the scratchpad before removal.

## Doctrine worth keeping

- **The holistic review earns its cost.** Run it over the whole diff, with a
  fresh reviewer that had no part in writing the feature, BEFORE committing
  implementation code. 023's found two defects that no per-chunk review could
  have seen, because each was a disagreement between two pieces of code that
  were correct on their own.
- **A review is evidence, not authority.** 023's reviewer reported an untracked
  `nul` file that had already been removed. Check findings before acting.
- **Tests that pass can still be blind.** Twenty one tests covered the paste
  panel and every one of them missed that it displayed nothing, because they all
  set a textarea's value without focusing it. When a gate claims to enforce
  something, make it render the thing.
- **Do not add a slow test to this suite.** One 900 line fixture rendered 901
  price list forms, took two seconds alone and blew the timeout in the full run.
  It was split: the DOM test checks drawing, a headless store test checks
  coverage.

## Deferred deliberately, do not "fix" without asking

- **F4, the interview wizard.** Gated on F1 usage. See Next up.
- **No cost range filter, no target margin mode, no bulk change to existing
  prices.** All three declined in `specs/022-bulk-pricing/spec.md` with reasons.
- **No fetching a price list from a URL, no image import, no second pass
  tracking** in 023. Reasons in `specs/023-import/spec.md`.
- **`gstack` review gates** (`plan-eng-review`, `review`, `qa`, `ship`, `cso`)
  are installed at `C:/Users/Emu/.claude/skills/` and unreachable from a
  `.claude-personal/` session. `CLAUDE.md` calls this a known gap being carried,
  not an unnecessary step.

## Blocked on Jakob

- **F4's gate**: has anyone actually used a starting point from feature 021?
  Unlocks specifying and building the interview wizard, the largest remaining
  idea from 2026-09-02.
- **Pushing anything.** Policy is commit locally, never push; a remote exists
  and `master` tracks `origin/master`, so the two have diverged by two commits
  and that is intended.
- **Whether feature work should use branches at all.** Delivery has gone
  straight to master since `Merge 009-imgur` on 2026-08-25, but
  `.specify/extensions.yml` still runs a mandatory branch-creating hook before
  every spec. This session created `023-import`, committed to master as
  instructed, and deleted the branch. A stale `022-bulk-pricing` branch is still
  there from the last time nobody decided.
