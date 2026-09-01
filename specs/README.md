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
| [012 page lifecycle](012-page-lifecycle/) | 2026-08-31 | **before** | no | no | no | no |
| [013 narrow escaping](013-narrow-escaping/) | 2026-08-31 | **before** | no | no | no | no |
| [014 undo instead of confirm](014-undo-instead-of-confirm/) | 2026-09-01 | **before** | no | no | no | no |
| [016 unit and details](016-unit-and-details/) | 2026-09-01 | **before** | no | no | no | no |
| [017 quantity pricing](017-quantity-pricing/) | 2026-09-01 | **before** | no | no | no | no |
| [018 more hosts](018-more-hosts/) | 2026-09-01 | alongside | no | no | no | no |
| [019 reviewed as a seller](019-reviewed-as-a-seller/) | 2026-09-01 | after the fact | no | no | no | no |
| [020 several pictures](020-several-pictures/) | 2026-09-01 | after the fact | no | no | no | no |

There is no 015. The number was skipped and nothing was lost: it is recorded
here so nobody goes looking for a missing document.

Features 011 and 012 are the first since 003 whose specs were written before the
code. Neither has a plan or a task list, because each is one screen's worth of
work and a plan for it would have been a paraphrase of the spec, but the
reasoning and the scope were settled on paper before anything was built.

They are worth reading in that order. 011 names two things it deliberately left
out; 012 is those two things, and it opens by amending a requirement 011 had got
right for a switcher and wrong for what the group became. The amendment is
recorded in 012 rather than edited into 011, because a specification that
quietly changes to match the code is worth nothing.

014 does the same thing to a decision two features older, and is the clearest
example of why these documents are worth writing. It removes the confirmation
that feature 010 added after a real mis-tap, and it has to argue with that
earlier reasoning rather than pretend it was never made. The mis-tap was real;
the confirmation was the wrong fix for it, and the right one was four pixels of
spacing.

**017 is the strongest example of the same habit.** Feature 016 was offered
quantity break pricing and recorded that it was declined, with reasons. 017 is
that feature, built after the substitute 016 relied on was tried and found
wanting. It quotes the passage it overturns rather than editing it, and argues
that the original reasoning was sound and still lost.

018 is labelled "alongside" rather than before or after, because the research
came first and changed the plan twice, and the specification records both
reversals: that text.is and rentry are not the same host despite the same
engine, and that the planned fix for the Markdown file download would have been
worse than the bug it fixed.

**019 and 020 came from using the thing rather than reading it.** Two complete
shops were built with the tool, as an illustrator and as a 3D print seller, and
that hour found eight defects in a codebase with 822 passing tests. 019 is the
seven that needed no schema change; 020 is the eighth, which needed one. Both
are after the fact and say so: the investigation produced the list, and the
list is what a spec written first would have contained.

019 carries the finding worth reading even if nothing else here is: **four of
its changes broke no existing test**, which is a coverage report rather than
reassurance, and three of the tests written during it are vacuous and kept with
that stated at the top of the file.

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
