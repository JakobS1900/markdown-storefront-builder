# Handoff

The live document a new session reads first. `CLAUDE.md` still points at
`specs/README.md` for what each feature is; this file is only about what is
happening right now and what to do next.

**Current state**: feature 023 is complete and committed as `fa8eb28`. Feature
022's missing holistic review has now been run: `b69266a` is the test it added,
`20d3192` is what it found. On top of that sit two UI fixes asked for directly
rather than through a feature: `e0f345b` is the preview table and the checkbox,
`053bdae` is the regenerated screenshots. `4d26e5f` then fixed a real test
failure that `npm run verify` caught on 2026-09-05, described under "Traps".
This file describes the tree at `4d26e5f`, and `npm run verify` is green on it.

**The working tree is NOT clean, and what is in it is not this session's.** A
full visual restyle of `app/src/styles.css` sits uncommitted, 530 lines added
and 97 removed, with all twelve files in `docs/media` regenerated to match it.
Nothing else is touched: no TypeScript, no tests, no specs. It is a coherent
piece of work rather than a scratch edit. It passes everything, contrast
included, in both palettes. It was left alone rather than committed or
reverted, because whose it is and whether it is finished are Jakob's to say.
See "Blocked on Jakob".

Every feature through 023 now has a holistic review except the ones
`specs/README.md` marks `no` for structural reasons, and that column is the
honest record of it.

## Next up, in order

1. **Run `npm run verify` from PowerShell before anything else.** It is the
   check that tells you whether the tree is actually where this file says it is.
   Expect 1081 tests, a11y 34, contrast clean in both palettes, pwa gate green.
   If it fails, read "Traps" below before believing it: several of its failures
   are environmental rather than real. It earned its place on 2026-09-05, when
   it caught a real failure that had been latent for days and was NOT one of
   the environmental ones. See the starters-picker entry under "Traps".
2. **F4, the interview wizard, is UNGATED as of 2026-09-04 and is the next
   feature.** `specs/021-starting-points/spec.md` gated it on whether a
   starting point turned out to be enough, because building a question by
   question interview before knowing that would be guessing. Jakob was asked on
   2026-09-04 and answered: **somebody used a starting point and it was not
   enough.** That is the evidence the gate was waiting for, and it opens.

   Route it as `CLAUDE.md` says: `/speckit-specify`, then `-plan`, `-tasks`,
   `-analyze`. It is a whole surface with its own state machine, so it will be
   several chunks, which means a holistic review before committing
   implementation code is mandatory rather than optional.

   **Do not start writing the spec without asking Jakob HOW it fell short**, and
   do not infer it from the code. The gate exists to stop this feature being
   guessed at, and opening it only to guess at the shape instead would waste the
   waiting. That question was put to Jakob on 2026-09-04 and this file will say
   so here once it is answered.
3. **Consider the test suite's timing fragility** (see "Traps"). Not urgent, and
   nobody has asked for it, so do not start it without saying so first. With
   022's review done, this is the largest thing left that needs nothing from
   Jakob, which is not the same as it being worth doing.

022's holistic review is **done**, so it is no longer on this list. It found no
defect in the code and two gaps in the evidence, both closed. Details are in the
last two entries of `specs/022-bulk-pricing/spec.md` under "Amendments made
during implementation", and the short version is worth carrying:

- FR-054c promised a gate that was never built, and the sweep it described would
  have compiled nineteen documents that carry no `cost` between them and passed
  forever. The real gate is a sentinel test, and it is better than the one the
  spec asked for.
- No test reordered a row with a selection standing and then applied pricing,
  which is the exact composition the version 3 schema change was taken for. It
  holds, because the apply path resolves rows by `id` throughout. There is now a
  test, and it was verified to discriminate.

## Verified live, do not re-probe

- **`npm run verify` passes end to end**, run alone on a quiet machine, both
  before and after 022's review. 1080 tests in 63 files, a11y 34, contrast 164
  elements and 12 sections in both light and dark with 0 failures, pwa update
  gate green. It was 1079 before the review added one test.
- **`cost` genuinely never publishes.** Not inferred from a passing test:
  `pricedAs` in `engine/src/compile/emit/menu.ts` was temporarily made to append
  the cost to the price, and `cost-never-published.test.ts` failed two of its
  three cases across all three targets, correctly leaving the diagnostics case
  green. Reverted. Do not re-probe this.
- **No starting point, no compile fixture and not `app/public/example.json`
  carries a `cost` field.** Checked directly. This is why the sweep FR-054c used
  to describe would have been worthless, and it is the fact that settles it.
- **A selection survives a reorder and still prices the right row.** Verified
  end to end, not inferred from the two halves that were already covered.
- **Master was green before 023 started.** The baseline run appeared to fail
  with 8 timeouts; every one was load flakiness, confirmed by re-running the
  files alone.
- **023's own repaint fix works.** `price-list-screen.test.ts` has a test that
  focuses the paste box before typing, which is the only state a real seller can
  paste from. It fails without the fix and passes with it.
- **`cost` still never publishes** for any target, including rows created by
  pasting. Asserted by compiling a converted row, not by inspecting the field.
- **The preview table's widths are measured, not guessed** (`e0f345b`). Driven
  in headless Chrome at 390px, before and after. Before: port 316 against
  content 336, columns 91, 60, 100, 84, cell height 590. After: port 316
  against 544, columns 103, 63, 235, 142, cell height 206, and the page still
  does not scroll sideways. Two dead ends were measured rather than reasoned
  about, and both are worth not repeating: a `min-width` floor on the cells
  gives every column exactly that floor (144, 144, 144, 144 at 9rem), because
  once the minimums pass the port there is no surplus for auto layout to hand
  out; and a floor on the table with no wrapper distributes correctly but sets
  the whole page scrolling sideways, since one element cannot be both the port
  and the content.
- **`min-width: 34rem` is inert in the split view.** Checked, not assumed: at
  1180px the table measures 110, 64, 311, 175 at 662 wide, identical to the old
  rule re-imposed at that width.
- **The checkbox accent follows the palette**: `rgb(122, 75, 214)` light,
  `rgb(179, 148, 245)` dark, where it was the browser's own blue. One
  declaration covers every checkbox, because `app/src/ui/dom.ts` has the only
  helper that makes one.
- **`npm run verify` passes on `053bdae`**, run alone. 1081 tests in 63 files,
  a11y 34, contrast 164 elements and 12 sections clean in both palettes, pwa
  gate green. It was 1080 before the table fix added one test.

## Traps that cost real time in this session

- **`starters-picker` is FIXED and is no longer on the fragile list**
  (`4d26e5f`, 2026-09-05). Read this before assuming a failure there is
  environmental, because for days it was assumed and it was not. Nothing timed
  out. `settle()` waited a fixed twelve macrotask ticks; a probe measured the
  starter open path needing **30 ticks cold and 3 warm**, because opening a
  starting point dynamically imports its document and the documents are lazy
  chunks on purpose. So the failure is ordinal rather than random: whichever
  test opens a starter first pays the module load and fails, every later one is
  warm and passes, and a run where something else already loaded the module
  passes all of them. The same tree passed verify on 2026-09-04 and failed on
  2026-09-05 for exactly that. `settleUntil` now waits on the condition, and
  was verified to discriminate by making the open path resolve without opening.
  **The lesson generalises and the other seven files have not had it applied:**
  a fixed tick count in front of anything that can dynamically import is a bug
  waiting for the right ordering, not a slow test.
- **The test suite has genuine timing fragility, and it is not yours.** Several
  tests sit at 3.8 to 4.7 seconds against a 5000ms default timeout:
  `page-list`, `page-lifecycle`, `example`, `undo-last`, `bulk-apply`,
  `repaint-while-typing`, `a11y`. Under any parallel load, or with
  a cold transform cache after edits, they time out. A timed-out test also
  pollutes the rest of its own file, which turns one timeout into what look like
  three unrelated assertion failures. Pollution is real and was seen again on
  2026-09-05: the starters-picker fix above presented as two failures, and the
  second vanished when the file was run alone.
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
- **`rtk` rewrites shell commands and mangles their output.** A hook sends
  `git`, `grep` and friends through the `rtk` proxy. It prints
  `Failed to resolve 'rg' via PATH`, renumbers `grep -n` output so the line
  numbers belong to a different file than the paths beside them, and reduced a
  `git status --short` to the single word `ok` and a whole vitest run to
  `PASS (1) FAIL (0)`. None of that is your code failing. **Do not read a
  gate's result through it.** Run anything whose exact output matters through
  the PowerShell tool instead, which is not intercepted, and prefer the Read and
  Grep tools over shell `cat` and `grep`.
- **`cat >>` corrupted a file again on 2026-09-04**, in the exact way
  `CLAUDE.md` says it will, this time appending a test to
  `app/tests/bulk-apply.test.ts` and breaking a comment forty lines further up.
  It is cheap to recover with `git checkout -- <file>` when the tree is
  otherwise clean, and the fix is to use the Write or Edit tools. The warning is
  in `CLAUDE.md` and was still walked into, so it is worth two lines here too.
- **A file named `nul` in the repo root is a Git Bash redirect accident**, but
  check before deleting: the one found this session was a valid 248 KB GIF. It
  was copied to the scratchpad before removal.

## Doctrine worth keeping

- **The holistic review earns its cost.** Run it over the whole diff, with a
  fresh reviewer that had no part in writing the feature, BEFORE committing
  implementation code. 023's found two defects that no per-chunk review could
  have seen, because each was a disagreement between two pieces of code that
  were correct on their own.
- **A late holistic review still earns it, and pays differently.** 022's was run
  two days after the feature shipped and found no defect, because by then the
  code had been exercised. What it found instead was two places where the
  evidence did not cover what the spec claimed: a gate that did not exist, and a
  composition nothing tested. That is the characteristic yield of a late review,
  and it is worth having. Do not treat "it found no bug" as "it was not worth
  running".
- **Check a gate by breaking the thing it guards.** Both of 022's promises were
  confirmed by injecting the defect and watching the right tests fail, then
  reverting. Every gate this project trusts was verified this way, and the two
  it did not verify are the two that turned out to be measuring nothing.
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

- **F4, the interview wizard.** No longer deferred. The gate opened on
  2026-09-04. See Next up.
- **No cost range filter, no target margin mode, no bulk change to existing
  prices.** All three declined in `specs/022-bulk-pricing/spec.md` with reasons.
- **No fetching a price list from a URL, no image import, no second pass
  tracking** in 023. Reasons in `specs/023-import/spec.md`.
- **No gate on the preview table's `34rem`.** The test added in `e0f345b`
  guards the structure the fix needs, that the table has a `.table-scroll`
  wrapper, which is what a later edit would quietly drop. jsdom lays nothing
  out, so the widths themselves were verified with a throwaway browser script
  rather than a repo gate, and that script was not kept. Promoting it to sit
  beside `contrast.mjs` was offered and not taken up. Ask before building it.
- **No affordance saying the preview table scrolls.** It is discoverable the
  usual way, by content visibly cut off at the right edge. A fade or a shadow
  was considered and not added.
- **`gstack` review gates** (`plan-eng-review`, `review`, `qa`, `ship`, `cso`)
  are installed at `C:/Users/Emu/.claude/skills/` and unreachable from a
  `.claude-personal/` session. `CLAUDE.md` calls this a known gap being carried,
  not an unnecessary step.

## Blocked on Jakob

- **The uncommitted restyle of `app/src/styles.css`.** It was in the tree
  already when the 2026-09-05 session opened, and no commit, spec or handoff
  entry accounts for it. What is needed is whether to commit it, whether it is
  finished, and whether the twelve regenerated media files go with it. Do not
  commit it as if it were this project's own work and do not revert it: the
  rule about never deleting Jakob's work covers a working tree as much as a
  saved document. A copy was taken to the session scratchpad before a `git
  stash` round trip and verified identical afterwards, ignoring line endings,
  which the repo's `.gitattributes` rewrites to CRLF. Unlocks committing it, or
  a design review of it, and it is the reason `docs/media` cannot be trusted to
  match any commit right now.
- **F4's shape**, not its gate. The gate is open: asked and answered on
  2026-09-04, somebody used a starting point and it was not enough. What is
  still needed before a spec can be written is HOW it fell short, which only
  Jakob saw. Unlocks specifying and building the interview wizard, the largest
  remaining idea from 2026-09-02.
- **Pushing anything.** Policy is commit locally, never push; a remote exists
  and `master` tracks `origin/master`, so local is ten commits ahead and none
  behind. That is intended, and the number only grows. Do not read it as
  something to tidy up.
- **Whether feature work should use branches at all.** Delivery has gone
  straight to master since `Merge 009-imgur` on 2026-08-25, but
  `.specify/extensions.yml` still runs a mandatory branch-creating hook before
  every spec. This session created `023-import`, committed to master as
  instructed, and deleted the branch. A stale `022-bulk-pricing` branch is still
  there from the last time nobody decided.
