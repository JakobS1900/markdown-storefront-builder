# Tasks

## Planning

- [x] T001 Define scope in specs/034-compact-import-review/spec.md.
- [x] T002 Record contract and constitution check in specs/034-compact-import-review/plan.md.
- [x] T003 Analyze spec/plan/tasks coverage before implementation and record result here.

## US1, one chunk

- [x] T004 [US1] Add failing scripts/import-layout.mjs browser regression, then minimally edit app/src/ui/page-paste.ts and app/src/styles.css; wire package.json verification.
- [x] T005 [US1] Run browser/correction tests; record measurements in docs/research/2026-10-05-compact-import-review.md.
- [x] T006 [US1] Fresh spec and quality reviews of the entire implementation diff; resolve findings.

## Delivery

- [x] T007 Run npm run verify; increment android/app/build.gradle test version, build, sign, install and inspect tablet.
- [x] T008 Update docs/HANDOFF.md, CLAUDE.md and specs/README.md; commit, push stacked PR and inspect CI.

Dependencies: T001/T002 -> T003 -> T004 -> T005 -> T006 -> T007 -> T008.
One tightly scoped implementation chunk; no parallel product edits.
FR-001/003/005 and SC-001/002: T004/T005. FR-002/004: T005/T006/T007.
SC-003: T007. No unmapped requirements.

Preflight: 5 requirements, 8 tasks, 100% requirement coverage, no critical/high
findings. Fresh plan review passed. Keep without a price must stay outside the
four-field grid while remaining associated with its source row.
