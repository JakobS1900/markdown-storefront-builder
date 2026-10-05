# Tasks

- [x] T001 Review spec, plan and requirements coverage; close material gaps before logic changes.
- [x] T002 US1: failing regressions, minimal classification/source-name fixes, focused tests.
- [x] T003 US1: independent spec review and code-quality review; fix findings. Fresh-thread capacity exhausted, separate existing reviewers used.
- [x] T004 US3: failing regressions, validated missing-MIME input and byte-read refusal fix.
- [x] T005 US3: storage/preview/export evidence, independent spec and quality reviews. Thread-capacity substitution as in T003.
- [x] T006 US2: tokenizer and table metadata tests, then conservative detection implementation.
- [x] T007 US2: source-span/furniture integration and real review/save regression tests.
- [x] T008 US2: independent spec and quality reviews, large fictional table smoke test. Thread-capacity substitution as in T003.
- [x] T009 Holistic review; full `npm run verify`; update handoff and status with limitations.
- [x] T010 Commit, push stacked draft PR, read CI results. PR #3; code push CI 37246417645 passed. No release or tablet claim.
- [x] T011 FR-014: reproduce the native image-picker failure, route image files through the existing document picker, independently review, and verify selection, preview, export and persistence on the connected tablet. Preserve prior pages and the seller-session release gate. Passed on test.7, 2026-10-05; see native evidence.

Dependencies: T001 precedes all implementation. Each review follows its chunk. T009 follows T003, T005 and T008. FR-001..004 map to T002/003; FR-005..009 map to T006..008; FR-010..013 map to T004/005.
