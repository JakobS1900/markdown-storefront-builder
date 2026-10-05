# Implementation plan

Base: 3484712 on 034. Branch: 035-clear-import-and-page-names.

Use the current TypeScript DOM components, CSS, Vitest and browser/device checks.
There is no cross-boundary contract change; Document parity remains unchanged.

## Constitution check

I engine purity and II host data: no engine or target edits.
III test first: meaningful failing UI tests before each chunk, then minimal code.
IV narrow gate: names enter DOM as text, with adversarial string checks.
V sacred work: existing title/store path, preserved page IDs and content.
VI accessibility: named controls, focus and 44px targets, narrow/browser checks.
VII honest fidelity: private naming leaves compiled output unchanged; import
choices retain original source and accurate scope. Simplicity: reuse existing
title disclosure and source-choice handlers.

## Chunk 1: import wording

Own app/src/ui/page-paste.ts and focused page-paste tests. Change source reuse
labels, adjacent scope copy and undo wording. Preserve source numbers in context
and unique accessible names. Existing UI helpers provide text insertion.
Test quantity conversion, selected subset counts, duplicate and long candidates,
quoted/markup values, no-candidate behavior, focus after use/undo and output.

## Chunk 2: saved-page naming

Own pages-sidebar.ts, build.ts, minimal shared UI helper if necessary, and
focused sidebar/build tests. Add one current-page action in shared panel content.
Switch to Build, close drawer, open existing title disclosure, focus and scroll
the real input into view. Reuse disclosure state APIs and avoid focus restoration
overriding the requested input. Keep title input/store callback unchanged.
Explain the private title purpose with existing field help. Test actual shell
navigation from Copy/Preview, empty/nonempty page and pinned panel, persistence,
unchanged compile output and deletion protection.

## Reviews and delivery

Fresh implementer per chunk, fresh spec reviewer then fresh quality reviewer.
Final whole-diff review after both chunks. Fix findings before full verification.
Parent runs npm run verify, browser widths, signed Android build and in-place
tablet update. Verify source choice/undo and drawer naming with native keyboard,
Preview/Copy, cold launch and saved-page preservation. Restore device settings.
Push branch, integrate into master, publish signed v0.13.0, inspect CI/deployment
and record evidence. Existing PRs 1 through 4 were audited ready and merged with
normal merge commits. Each intermediate master tree matched its verified branch.
Current feature base fast-forwarded to d5f36e9, identical in content to 3484712.
