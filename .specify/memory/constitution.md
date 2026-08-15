<!--
Sync Impact Report
Version change: none -> 1.0.0
Bump rationale: initial ratification, all placeholders replaced with concrete rules.
Modified principles: none (first ratification)
Added sections: seven core principles, Additional Constraints, Development Workflow, Governance
Removed sections: none
Templates requiring updates:
  - .specify/templates/plan-template.md: UPDATED, Constitution Check gate now enumerates
    all seven principles as a table that must be filled per plan
  - .specify/templates/spec-template.md: OK, no mandatory sections added or removed
  - .specify/templates/tasks-template.md: UPDATED, "Tests (OPTIONAL - only if tests
    requested)" contradicted Principle III and is now MANDATORY; foundational phase now
    lists the constitution-driven tasks (schema parity, golden harness, determinism and
    round-trip, sanitizer corpus, CI secret scan and a11y)
  - CLAUDE.md: OK, already carries the non-negotiables and skill routing
Deferred TODOs: none
-->

# Markdown Storefront Builder Constitution

This project compiles a block document model into host-correct Markdown for people
who do not know Markdown. Every rule below exists because breaking it either lies
to those users or destroys their work.

## Core Principles

### I. The Engine Is a Pure Function (NON-NEGOTIABLE)

`compile(doc, targetId)` MUST be a pure function. It MUST NOT touch the DOM, MUST NOT
perform network I/O, MUST NOT read a clock, and MUST NOT consume randomness. Given an
identical document and target it MUST produce byte-identical Markdown on every run and
on every machine.

`compile()` MUST NOT throw for any input that passes the schema validator. Problems are
returned as diagnostics, never raised. A builder that crashes on a half-finished page is
useless to someone assembling one on a phone.

Rationale: determinism is what makes golden-file testing possible, which is what turns
"this renders correctly on that host" from a claim into a checkable fact. Purity is also
what lets a reviewer read the engine and judge it without running it.

### II. Hosts Are Data, Never Code

A supported host MUST be expressed as a target record of capability flags plus golden
fixtures. Adding, removing, or correcting a host MUST NOT require any change to engine
code. Any pull request that adds a host and also edits an emitter is a design failure
and MUST be rejected or redesigned.

Every capability flag MUST have a declared fallback. There is no such thing as a
capability the engine handles by producing broken output.

Rationale: host renderers change without warning. The cost of tracking them must stay
proportional to editing a data file.

### III. Test-First, With Golden Files (NON-NEGOTIABLE)

TDD is mandatory: a failing test is written first, then the minimum code to pass it.

Every target MUST have a golden fixture set that is byte-compared in CI. Every emitter
change that alters output MUST show the golden diff in its commit.

Three tests are structurally required and MUST exist before the code they guard:

1. A determinism property test asserting identical input yields identical bytes.
2. A lossless round-trip test for `Document` to JSON and back.
3. A parity test on the `Document` schema asserting field names, types, and order.

Rationale: the schema crosses the engine, the app, IndexedDB, the URL fragment, and the
export file. On prior projects, a schema that crossed a boundary at multiple sites was
the single most fragile thing in the codebase, and only a parity test stopped silent
corruption each time a field was added.

### IV. The Narrow Gate

All user-authored content MUST pass the sanitizer before entering the preview DOM. The
sanitizer MUST be exercised by an XSS corpus test, and that corpus MUST grow by one case
whenever a new user-authored field is introduced.

Raw HTML MUST be emitted only when the target record permits it AND the user has
explicitly opted in. Both conditions, never one.

No secret MUST ever appear in the client bundle. CI MUST fail on a secret scan hit. The
upload proxy MUST re-validate everything the client validated, MUST determine file type
from magic bytes rather than the declared header, and MUST enforce a byte ceiling and a
per-IP rate limit.

Rationale: the preview renders user-authored Markdown in our own origin, so it is a real
XSS surface. Client-side validation is a UX affordance, never a control.

### V. The User's Work Is Sacred

The `Document` MUST carry a `schemaVersion`. Opening a document from a newer schema than
the running app understands MUST refuse cleanly and MUST NOT write to it. Migrations are
forward-only and MUST be covered by a fixture per version step.

No failure path MUST ever delete or overwrite a user's saved document in order to
recover. Preserve it and report honestly.

Storage exhaustion, upload failure, and dead image URLs MUST each surface a specific,
named message with a next step. A generic failure message is a defect.

Rationale: losing an artist's page is the one failure they will never forgive, and it is
the failure most likely to be caused by our own cleanup logic.

### VI. Reachable By The People Who Need It

Every interactive control MUST present a touch target of at least 44 by 44 CSS pixels,
MUST have an accessible name, and MUST be operable by keyboard. CI MUST run automated
accessibility checks and MUST fail on violations.

The app MUST remain fully functional with the upload proxy unavailable, degrading to URL
entry with an honest message rather than a broken control.

Rationale: the users are non-technical people on phones. A keyboard-only, mouse-assumed,
always-online UI fails exactly the population this product exists to serve.

### VII. Honest Fidelity

The preview MUST render the compiled Markdown output, never an internal render of the
block model.

Where our approximation of a host's renderer can diverge from that host, the limitation
MUST be stated in the product UI, not only in documentation.

Rationale: showing an artist a picture no host will produce makes the entire value
proposition a lie. A stated limitation costs a sentence. A discovered one costs trust.

## Additional Constraints

The engine MUST have zero runtime dependencies and MUST NOT import from the app.
Dependency direction is app depends on engine, never the reverse.

Supported targets for v1 are exactly two: `rentry` and `portable`, the latter being a
strict CommonMark plus GFM tables baseline. Plain-text paste sites are out of scope
because they do not render Markdown at all.

A target record MUST NOT be written from memory or assumption. Its capability values MUST
be derived from that host's published documentation or from observed behaviour on the
live renderer, and the source MUST be cited in `docs/research/`.

Out of scope for v1 and requiring an amendment to introduce: accounts, cloud sync, direct
publish via host APIs, custom CSS on output, collaboration, a templates marketplace, and
internationalization.

## Development Workflow

The `Document` schema lands FIRST, alone, in its own commit, with its parity test, before
anything consumes it.

Implementation proceeds in chunks aligned to phases, not one dispatch per task. Each chunk
gets a fresh implementer, then a fresh spec-compliance reviewer, then a fresh code-quality
reviewer. Any feature exceeding roughly three chunks MUST also receive one holistic review
over the whole diff, because per-chunk reviews each see one internally correct side of a
seam and structurally cannot catch cross-cutting bugs.

Review work deferred to a later chunk MUST be recorded as a `CHUNK N:` code comment at the
exact site, never as prose.

"Done" means verified with evidence: the command was run, the output was read, and it is
quoted. "Should work" is not done.

Commits MUST contain no AI attribution of any kind. No text in this repository, including
code, comments, commit messages, specs, and UI copy, may contain an em dash or an en dash.
Hooks MUST pass and MUST NOT be bypassed. Work is committed locally and never pushed
without explicit instruction.

## Governance

This constitution supersedes tool defaults, generated templates, and plugin boilerplate.
Where a generated artifact conflicts with a principle here, this file wins and the
artifact is corrected.

Amendments require a written rationale in the amending commit and a version bump under
semantic versioning: MAJOR for removing or redefining a principle, MINOR for adding a
principle or materially expanding guidance, PATCH for clarifications and wording.

Every plan MUST pass a Constitution Check that names each principle and states how the
plan satisfies it, or documents an explicit, justified exception. An exception without a
written justification is a blocker, not a note.

The gstack review gates are currently unavailable in this environment and their absence is
a known, accepted gap rather than evidence that review is unnecessary. Reinstating them
does not require an amendment.

Runtime development guidance lives in `CLAUDE.md`.

**Version**: 1.0.0 | **Ratified**: 2026-08-15 | **Last Amended**: 2026-08-15
