# Specifications

## What this index is for

The spec pipeline ran properly for the engine and then thinned out. Nine feature
branches exist in the history and all nine were merged, but specification
documents were only ever written for the first three. After
`Merge 009-imgur` on 2026-08-25 the branching stopped too: everything since has
gone straight onto master.

That gap was invisible from inside the repository, and worse than invisible.
`CLAUDE.md` told every new session to read `specs/002-compile-skeleton/plan.md`
as "the current plan", so a session would open a finished document and take it
for the present state. That pointer is gone now, and this file replaces it.

Features 004 to 010 below were **specified after they shipped**. They are
labelled as such in their own headers and they are not pretending otherwise: a
document written after the fact records what was built and why, not what was
predicted. They are worth having because the reasoning behind a decision is the
part that is expensive to reconstruct, and because "what is done" should be
answerable without reading fifty commit messages.

## Status

| Feature | Shipped | spec | plan | tasks | eng review | holistic |
|---|---|---|---|---|---|---|
| [001 document contract](001-document-contract/) | 2026-08-15 | yes | yes | 39/39 | yes | yes |
| [002 compile skeleton](002-compile-skeleton/) | 2026-08-15 | yes | yes | no | yes | yes |
| [003 block emitters](003-block-emitters/) | 2026-08-15 | yes | no | no | no | yes |
| [004 app shell and editor](004-app-shell-editor/) | 2026-08-15 | after the fact | no | no | no | no |
| [005 offline and installable](005-pwa/) | 2026-08-18 | after the fact | no | no | no | no |
| [006 images](006-images/) | 2026-08-18 | after the fact | no | no | no | no |
| [007 ship](007-ship/) | 2026-08-18 | after the fact | no | no | no | no |
| [008 inline formatting](008-inline-formatting/) | 2026-08-21 | after the fact | no | no | no | no |
| [009 Imgur and Android](009-imgur/) | 2026-08-25 | after the fact | no | no | no | no |
| [010 field work](010-field-work/) | ongoing since 2026-08-25 | after the fact | no | no | no | no |
| [011 page list](011-page-list/) | 2026-08-31 | **before** | no | no | no | no |

Feature 011 is the first since 003 whose spec was written before the code. It
has no plan or task list either, because it is one screen's worth of work and a
plan for it would have been a paraphrase of the spec, but the reasoning and the
scope were settled on paper before anything was built, and the two things
deliberately left out are named there rather than discovered later.

Plan, tasks and review columns are left honestly empty. Writing a retrospective
"plan" for work already finished would be fiction, and a retrospective task list
would be a commit log with the dates filed off. The architecture and holistic
reviews for 001 to 003 are real documents produced before and after that code
was written, which is why they are marked yes and nothing later is.

## Where the phases landed

`docs/ROADMAP.md` is the plan of record and every item on it is complete. It has
one gap of its own: the Android build is not on it at all, because the roadmap
was written before anyone decided the app would be wrapped natively. Feature 009
and feature 010 are the platform the owner actually uses, and the roadmap does
not mention them.

## The pattern worth knowing before you add to this

Three defects in this project were caused by a comment claiming something that
was not true, and each survived because the claim was plausible:

- `render-markdown.ts` said "the XSS corpus test asserts exactly that". There
  was no such test, and nothing anywhere imported the module.
- `styles.css` and `shell.ts` both introduced the wide-screen rules as "Build
  beside Preview". No split view existed until 2026-08-31.
- `CLAUDE.md` named a current plan that had been finished for a month.

A document that describes an intention as though it shipped is worse than no
document, because it stops anyone looking. If you write one of these, say what
is true today and name what is missing.
