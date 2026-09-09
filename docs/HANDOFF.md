# Handoff

The live document a new session reads first. `CLAUDE.md` still points at
`specs/README.md` for what each feature is; this file is only about what is
happening right now and what to do next.

**Released**: `v0.9.0`, from `c0f58fc`, versionCode 13, versionName 0.9.0.
`v0.8.0` is `49ab971`, `v0.7.1` is `d27f470`, `v0.7.0` is `108c4a7`. **Every tag
through 0.9.0 is on `origin`**, confirmed with `git ls-remote --tags origin` on
2026-09-08, `origin/master` is at `c0f58fc`, and the GitHub Release for 0.9.0
exists with the signed APK attached: 3,228,912 bytes, `isDraft: false`, checked
with `gh release view v0.9.0`.

**Feature 026 is DONE and SHIPPED.** `026-selling-modes` is merged to master.

**In progress: feature 027, the setup wizard. Branch `027-setup-wizard`.
Phases 1, 2, 3 and 4 are DONE. Phase 5, the way in and the way out, is next.**

`be5c8f7` is the last commit with CODE in it, and it is the tree every number in
this file describes. Anything after it on this branch is documentation, this
sentence included, which is why HEAD will not match that hash and nothing is
wrong when it does not.

**`origin` has everything**, up to and including the documentation commit
`97d0782`, verified with `git log --oneline -1 origin/027-setup-wizard` on
2026-09-09 with a clean `git status`.

The one command that tells you which branch is live:

```powershell
git rev-parse --abbrev-ref HEAD   # expect 027-setup-wizard
git log --oneline origin/master..HEAD
```

If that says `master`, check out `027-setup-wizard`. If the branch is gone, 027
was merged and released while nobody updated this file, and `git log` on master
is the truth.

**Start at `specs/027-setup-wizard/tasks.md`, Phase 5, task T035.** Read
`research.md` before anything else: it reverses part of the spec, and the spec
carries that amendment in its own text rather than only in research. R3 is the
one Phase 5 turns on, and R1 is what Phase 4 was built from.

**Read the `CHUNK 4:` seam comment in `app/src/ui/wizard.ts` before writing any
of Phase 5.** It names four things not to get wrong, and the third is the one
that will otherwise be missed: **nothing in the app calls `rememberWizardOpen`
yet**, so FR-133 is wired on one side only. `surface-history.ts` has the
function and the `popstate` branch that consumes its entry, and only the tests
call it, by hand. T036 must pair it with `openWizard()` at the trigger the way
`shell.ts` pairs `rememberSidebarOpen()` with `openSidebar()`. Until it does,
the first back gesture on the Build surface leaves the app rather than
dismissing the wizard, because Build deliberately pushes no history of its own.

**Phase 2 will NOT be released on its own.** Asked and answered on 2026-09-08:
Jakob chose "Phase 3 now, release later", so the hints ship with the whole 027
release at the end. Do not cut a 0.9.1 for them and do not re-ask. The full
entry is under "Blocked on Jakob".

The APK was verified before it was published, both ways the trap list demands:
`assets/public/assets/index-C9AYi9o0.js` is inside it, matching what the build
had just emitted, so it is not the stale-assets failure that nearly shipped in
0.4.0; and `apksigner verify` reports v2 true, v3 true, and certificate digest
`c952b39c...`, matching `docs/RELEASE.md`.

Installed on the Moto G7 with `-r` over the previous release, no uninstall.
`dumpsys package` reports versionCode 13, versionName 0.9.0. **Both new controls
were seen on the handset**: a blank row still shows Item and Price and nothing
else, and `More details` holds "How you sell it (optional)" as a native select
reading "Do not say" with "How long the buyer waits (optional)" under it.
`svc power stayon` was set back to false afterwards, because it is the owner's
setting and not ours.

**The push rule changed on 2026-09-07 and this file used to contradict it.**
`CLAUDE.md` rule 3 now grants pushing, tagging and publishing releases as
ordinary work, in Jakob's words, because the old rule composed badly with "tag
often" and stranded 0.5.0 and 0.6.0 locally. Then 024 was pushed as commits and
never released, so Jakob still saw 0.6.0 on the Releases page and reasonably
concluded nothing had shipped. **Pushing commits is not shipping.** A feature is
delivered when there is a tag and a Release with an APK on it.

The "Released" line above said the opposite for part of 2026-09-06: that 0.5.0
and 0.6.0 were tagged locally only and nobody outside this machine had them.
**That was wrong and it was written here without being checked.** It came from reading an earlier
version of this file, which recorded that the 0.4.0 push grant did not carry
forward, and inferring from that that no later push happened. `git ls-remote
--tags origin` settles it in one command and shows both tags present.

Recorded rather than quietly deleted, because it is the same failure this file
already documents once: a claim entered the handoff, in the file the session was
maintaining, with nothing corroborating it. The rule that came out of that one
was about quoting Jakob. It generalises. **Do not write a fact about the remote
into this file without running a command against the remote.**

**Tag often from here.** Jakob's instruction on 2026-09-05, after 0.4.0 went out
carrying seventy commits and four days. A tag per feature or per handful of
fixes, not a fortnight in one. The policy and the reasoning are in
`docs/RELEASE.md` under "How often"; this line exists so a session that reads
only the handoff still knows. It no longer needs to be asked for, per the rule
change above.

**Current state**: this file describes the tree at `be5c8f7` on
`027-setup-wizard`, and `npm run verify` is green on it, run whole and unpiped
from PowerShell on 2026-09-09:
**77 test files, 1464 tests, a11y 53, contrast 411 elements, 45 fields, 32
folded fields and 39 hints with 0 failures in both light and dark, secret scan
clean over 444 files, dash scan clean over 319 files, menu file gate clean, pwa
update gate clean, exit code 0.**

Those are the numbers to expect. If they are lower, something stopped rendering
rather than something being fine.

It was 76 files and 1431 tests at `0927639`. The 33 new ones are all
`app/tests/wizard.test.ts`. **a11y and contrast did NOT move, and that is
expected rather than a gate missing something**: neither one opens the wizard
yet. That is Phase 6, T042 to T047, and it is now the load bearing phase of this
feature, because a whole new modal surface with nine buttons on its first screen
is measured by nothing at all until it lands. This project has three times found
a gate green about a surface it never laid out.

Before Phase 4 the same paragraph said the gates not moving was correct because
Phase 3 added no surface. That was true then and is NOT true now. Phase 4 added
the surface, and the gates still do not see it.

Note the contrast number: 411, not the 167 the last three sessions saw. It was
404 at `ce56f2d` and rose to 411 when feature 027 phase 2 added hints, which is
the gate confirming the new text is really being measured rather than assumed.

The reason it moved at all: the gate had never measured a price row. It opens
whichever section offers itself first,
which on the example is a Text block: one field, no rows, and zero `details`
anywhere under `#surface`. So the cost, the unit, the quantity breakdown, the
labelled details and every hint in that fold were unmeasured, and nothing said
so, because a gate that measures less does not complain about it. `ce56f2d`
opens Prices and every fold in it, counts `folded` fields, and refuses a run
that cannot show at least five. **That is now the third time a gate here turned
out to be green about something it never looked at.** The lesson is in the file:
probe what the run actually laid out, do not infer it from the step that was
supposed to lay it out.

**Update this file when a feature lands, not when somebody remembers.** It went
stale by three releases between 0.6.0 and 0.8.0 and described a push rule that
had been reversed.

Before those, feature 023 completed as `fa8eb28`, feature 022's missing holistic
review ran (`b69266a` the test, `20d3192` the findings), two directly requested
UI fixes landed (`e0f345b` the preview table and the checkbox, `053bdae` the
regenerated screenshots), and `4d26e5f` fixed a real test failure that
`npm run verify` caught on 2026-09-05, described under "Traps".

The restyle that was sitting uncommitted is now `a3998c3`, with the twelve
regenerated media files as `a9ecb4d`. Both are long since pushed and released;
the "nothing pushed" that used to end this line described 2026-09-06 and was
left behind by three releases.

The design review of it ran on 2026-09-05 and found four defects, all fixed and
committed one apiece: `b940fd0` the detached tab bar, `6b8bc45` the seven solid
accent buttons, `e1138d9` the skip link's leaking shadow, `b8efe30` summaries
that stopped mid sentence with no ellipsis, and `dc68870` docking the
add-a-section row above the tab bar, which Jakob chose from three options after
the cost of each was measured. That one costs 117px: at 390x844 the chrome is
237 of 844 and 607 is left for content. A single scrolling row would buy most of
it back and would hide options behind a swipe, and that was not taken.

`a6d1314` came out of the same session and is not a design fix. The contrast
gate was failing about half the time inside `verify`, which `CLAUDE.md`
described as occasional and told you to re-run alone. Re-running alone always
worked, which is what hid the cause: a fixed 1500ms sleep in front of a click
that fetches and stores the example document. It now waits for the same counts
the guard checks. **Two fixed-wait bugs in unrelated files in one day**, this
and `4d26e5f`, is the pattern worth carrying: a fixed wait in front of
asynchronous work is a bug with a delay on it, and this repo has more of them.

`3bc399e` is the regenerated media,
and it carries a correction: a claim in `e1138d9` that the smudge appeared in
the committed screenshots is wrong, and the pixels say so. The defect was real,
the claim about where it showed was not.

**What the review checked and found clean**, so it does not get re-checked:
touch targets (nothing under 44px), focus rings (solid 3px accent on buttons,
selects, textareas, the tab bar and the skip link), horizontal overflow (none at
390px on any tab), the radius scale (9, 15, 999, a real hierarchy rather than
one bubbly value), and contrast in both palettes. Two paddings are off the 4px
scale, 8.8px and 10.4px, and were left alone: churn across every surface for
nothing anybody can see.

Its provenance, because it is not in any spec and a later session will wonder:
Jakob commissioned it from a session that was cut off partway when an account
limit was hit, and it was still in the working tree when the next session
opened. It was checked for completeness before being committed rather than
taken on trust, since a session that dies mid restyle leaves screens it never
reached. Every surface was looked at in both palettes and at both widths, the
CSS was checked against its own stated intent, and the two fixes from `e0f345b`
were confirmed carried rather than overwritten. It is finished. It has NOT had
a design review, which is a different question from whether it is complete.

Every feature through 023 now has a holistic review except the ones
`specs/README.md` marks `no` for structural reasons, and that column is the
honest record of it.

## Next up, in order

1. **Check the branch, then run `npm run verify` from PowerShell.** The branch
   command is at the top of this file. `verify` is the check that tells you
   whether the tree is where this file says it is. Expect **1464 tests, a11y 53,
   contrast clean in both palettes at 411 elements**, menu file and pwa gates
   green. If it fails, read "Traps" below before believing it: several of its
   failures are environmental rather than real. It earned its place on
   2026-09-05, when it caught a real failure that had been latent for days and
   was NOT one of the environmental ones. See the starters-picker entry.

   Done twice on 2026-09-09, green both times: at `0927639` before any work at
   the old numbers, and at `be5c8f7` with Phase 4 on it. Numbers under "Current
   state".

2. **Nothing is waiting to be pushed.** `origin/027-setup-wizard` is at
   `97d0782`, confirmed on 2026-09-09 with `git log --oneline -1
   origin/027-setup-wizard` after the push. `CLAUDE.md` rule 3 makes pushing
   ordinary work that does not need asking for, and this file's own history is
   the reason the rule exists: 0.5.0 and 0.6.0 sat local because nobody owned
   the re-ask.

3. **Feature 027 Phase 5, task T035, is the actual next piece of work.**
   `specs/027-setup-wizard/tasks.md` has 58 tasks in seven phases; 36 are done.

   Phase 5 is the way in and the way out. **Read `research.md` R3 first**, and
   then the `CHUNK 4:` seam comment at `finish()` in `app/src/ui/wizard.ts`,
   which was written for exactly this task and names four things not to get
   wrong. The two that will otherwise be missed:

   - **Nothing calls `rememberWizardOpen`.** T036 pairs it with `openWizard()`
     at the trigger, the way `shell.ts` pairs `rememberSidebarOpen()` with
     `openSidebar()`. Until then FR-133 is wired on one side only and the first
     back gesture on Build leaves the app instead of dismissing the wizard.
   - **The trigger must carry `aria-controls="wizard-panel"` and sit inside
     `#app`**, because `renderShell` finds it with `root.querySelector`. That
     lookup is the one part of the focus restore nothing proves today: the test
     supplies its own trigger, and it cannot do better, because `render` calls
     `replaceChildren` on the root and destroys anything a test appends. T035 is
     where that assertion finally becomes possible.

   `finish()` currently closes the wizard and creates nothing. T037 replaces it
   with `openBackup(serializeDocument(doc))` built from `documentFromAnswers`
   and `starterIdFor`, wrapped in the same `setBusy` and offline `load()` catch
   `starterPicker` already carries.

   **Phase 4 is DONE and both its reviews ran.** `app/src/ui/wizard.ts` is the
   layer, six screens, the moves and the keyboard handling, and it decides
   nothing about what an answer means. 33 tests in `app/tests/wizard.test.ts`.

   What the two reviews found and what was done, so none of it is reopened:

   - **Escape out of a text field left the wizard on screen** while the store
     said it was closed. `repaint` defers while a field holds focus and
     reschedules every 200ms; Escape does not blur. Fixed in `closeWizard`
     rather than at the Escape handler, because the back gesture arrives through
     `popstate` with no pointer and had the identical bug. **The test for it is
     the only one in that file that subscribes the renderer the way `main.ts`
     does**, and therefore the only one that crosses the repaint deferral at
     all. Do not "simplify" it to call `renderShell` by hand.
   - **`sectionToOpen` returned the constant `"gallery"`** and five of the eight
     starting points do not have one. It takes the starting point now and falls
     back to the profile block, which every starter has and which carries
     `avatarUrl`. Proved by reverting it: the test names `art-commissions`
     rather than failing a count.
   - The bottom safe area, a no-op guard on `setWizardStep`, a duplicated test
     deleted, and three comments that claimed more than they could deliver.

   **Two questions were deliberately left for T048**, not forgotten: whether
   `sectionToOpen` belongs in `wizard-answers.ts` (the two reviewers disagreed),
   and roughly 35 lines of focus-sync duplication between `wizard.ts` and
   `pages-sidebar.ts` that the same argument used to justify sharing `trapFocus`
   would also cover. Both are marked `CHUNK 4:` in the code.

   **Answered by Jakob on 2026-09-09, do not re-ask.** The store name field is
   called "Store name" in BOTH the wizard and the editor. It was "Your name" in
   the editor, so one answer had two names depending on the screen. He chose to
   rename both. `app/tests/typing.test.ts` and `app/tests/stale-edit.test.ts`
   drive that field by label and were updated with it. Separately, all four
   selling modes stay on the wizard's selling mode screen, "Sold out" included:
   he was unsure, and keeping them is both the no-change answer and the one
   FR-124 wants, since the list is read from the engine's own map.

   **Run Phase 5 through the chunk pipeline the way `CLAUDE.md` asks**: one
   fresh implementer subagent for the chunk, then a fresh spec-compliance
   reviewer, then a fresh code-quality reviewer. **It is worth the tokens.**
   Phase 4 ran it and the two reviewers between them found a bug that would have
   shipped, a promise the screen made and could not keep for five of eight
   starting points, and three comments that overclaimed. The implementer's own
   report said Phase 4 was complete and correct.

   **The rate limit is a real hazard here.** On 2026-09-08 an implementer died
   on one, and on 2026-09-09 BOTH reviewers died on one, in parallel, before
   reading a single file. Run the two reviewers SEQUENTIALLY rather than at
   once. If one dies, the limit resets on a clock, so retrying is better than
   the fallback. The fallback, if it comes to that, is to do the work in
   session, test first, and **write the debt into the code as a `CHUNK N:`
   comment** so T048 finds it. Do not quietly treat a dead subagent as a lighter
   process.

4. **026 is released. Nothing is outstanding on it.** Done on 2026-09-08, all
   of it: merged to master, pushed, tagged `v0.9.0`, Release published with the
   signed APK, installed and seen working on the handset. Details at the top.

   **Never `Set-Content` the version.** It writes a UTF-8 BOM into
   `build.gradle` and Gradle then fails in about one second with no useful
   message. That cost real time on 2026-09-07. Use Edit, and check the first
   three bytes if a build dies instantly. Done that way this time, and checked:
   `97,112,112`, not `239,187,191`.

   Still unfixed and worth putting to Jakob at some point: the FileProvider
   share sheet preview under T058 below, a two line change in
   `MainActivity.java` and the only thing anybody notices about the share sheet.
   It has now been carried past three releases without being raised.

5. **Feature 026, selling modes, is DONE apart from the release.** How an item
   reaches a buyer, and how long the buyer waits.

   Where it came from: Jakob asked for a wizard that would ask what kind of
   store somebody has and how they sell, and this is the schema half of that,
   landed first on purpose so the wizard has something to write into.

   | Commit | What |
   |---|---|
   | `7677876` | The spec, and the one decision expensive to revisit. |
   | `f0ba7f4` | `sold-out` put back after being specified out. |
   | `ee5dc12` | Schema version 5. The contract, alone. |
   | `4950542` | The Availability column, and the goldens proving nothing moved. |
   | `ce56f2d` | The two controls, and the contrast gate that had a hole in it. |

   **`sold-out` is the decision worth reading.** It was specified out on the
   argument that `price` is free text precisely so sellers can write things that
   are not numbers, so "SOLD OUT" already had a home. Jakob overruled it the
   same day: people use it a lot. The reasoning error is the carry-forward.
   **A thing people do constantly through a field that was not built for it is a
   missing feature being worked around, not a convention that has settled.**

   **THE VALUE SET IS CLOSED AND CHANGING IT IS EXPENSIVE.** The validator
   refuses a page carrying an enum value it does not recognise, so a fifth mode
   added later makes new pages unreadable to builds already installed.
   Recoverable, FR-018 hands the bytes back, but not free. `descriptor.ts` says
   this at the field.

   **Proved, not assumed, that no existing page moved.** All eight starting
   points and the bundled example were compiled for all four targets against the
   engine at `49ab971` and again at `ce56f2d`: 36 files, 57,648 bytes, byte
   identical. That is T025 and it does not need redoing.

   **Driven in a real browser on 2026-09-08**, which is T026. A row set to Made
   to order with "about 2 weeks" produces
   `| Carved oak sign | 80 | Made to order, about 2 weeks |` on the Copy tab,
   the same in Preview and in the menu file preview, and a real 2,047 byte
   `menu.html` of type `text/html` carrying that row. Clearing the mode back to
   "Do not say" and emptying the wait removes the Availability column entirely
   and returns the exact pre-026 bytes. The words in the dropdown are the words
   the page prints, because both come from one exported map,
   `SELLING_MODE_WORDS`.

6. **F5, the menu file, is DONE** and was the feature before 025.
   Jakob decided this on 2026-09-06 in the session that writes it down, which is
   the rule item 3 below exists to enforce.

   **Where it came from, first hand.** People are testing the app and one of
   them asked for three things: a menu they can save as a file and send to
   somebody that still looks good, because a `.md` file loses the styling and
   the paste hosts are unreliable for them; prices laid out as an item and a
   price with the amounts underneath; and their own pictures rather than hunting
   for a web address for every photo.

   **Two of those three are already built and merely unfindable, which is the
   finding that shaped the feature.** The per item price breakdown exists:
   `engine/src/compile/emit/menu.ts:80` switches the whole section to a per item
   layout the moment any row has quantity breaks, giving a heading carrying the
   name and price followed by its own `| Quantity | Price |` table. Nobody finds
   it because it lives in the `More details` fold labelled `Bulk pricing`
   (`app/src/ui/forms.ts:493-519`). Headings exist too: `heading` is one of the
   six block kinds with levels 1 to 6. So the new work is the saved menu file
   and pictures held on the device, plus a relabel.

   **The load bearing design idea: the menu file is a host.** Principle II says
   hosts are data, so add a `MENU_FILE` target carrying two new capability
   flags, `localImages` and `dataImages`, that every paste host has as `false`.
   The engine then stays pure and knows nothing about "offline": it reads a flag
   exactly as it already reads `tables`. The fallback for `localImages: false`
   is that the picture is dropped and a `local_image_unsupported` warning names
   it, the same shape as the existing `table_unsupported`.

   **Jakob's constraint, in his words: lock it as an offline feature**, so
   nobody adds their own pictures and then rage quits when they do not appear in
   the pasted page. The target design is what makes that structural rather than
   a warning nobody reads: Preview renders the compiled output for the selected
   paste host (Principle VII), so a seller who adds a picture and selects
   `rentry` sees it absent AND sees a warning saying where it does appear.

   `text.is` carries `maxBytes: 200000` and that is the hard evidence for the
   lock: one 1600px JPEG as base64 exceeds the entire published page budget by
   itself, and the only feedback would be one non blocking `size_limit_exceeded`
   warning after the fact.

   **FEATURE 024 IS COMPLETE as of 2026-09-06.** Every phase, the holistic
   review, and the on device measurement. What remains is release work, not
   feature work: see "Next up" item 1 below.

   | Commit | What |
   |---|---|
   | `c5af80e` | Schema version 4. The contract, alone. |
   | `da03450` | `MENU_FILE` target, `localImages` capability, `ALL_TARGETS`. |
   | `fba0a52` | The menu file itself, plus the `npm run menu-file` browser gate. |
   | `5ed22c1` | Renderer label pattern. A real forgery bug, see below. |
   | `9b11b6a` | Asset resolution moved onto nodes. The same bug one layer up. |
   | `2fb0156` | Pictures from the device, and storage that says what went wrong. |
   | `89b5d6f` | versionCode 10, and T058 measured on the real phone. |
   | `1e8013b` | The relabel. `Bulk pricing` becomes what it does. |
   | `db8e869` | The holistic review's findings, which were all seams. |

   `npm run verify` is green: 69 test files, 1288 tests, a11y 50, contrast clean
   in both palettes, menu file gate clean, PWA gate clean, exit 0.

   **T046 and T047 were pulled forward** out of Phase 4 into Phase 3, because
   the exporter could not be made correct without them. Do not do them twice.

   **The holistic review found two high severity defects**, both seams where
   each side was internally correct and tested, and one of them was introduced
   by the fix for an earlier review finding. Read
   `specs/024-menu-file/holistic-review.md` before concluding that per chunk
   reviews are enough on the next feature. They were not, again.

   **One finding is deliberately open**: `scripts/menu-file.mjs` never exercises
   a picture from the device, because it drives the bundled example and assets
   live in IndexedDB. That half of the saved file is covered only under jsdom,
   which lays nothing out.

   The plan is at
   `C:/Users/Emu/.claude-personal/plans/some-of-my-friends-breezy-rocket.md`,
   and it is STALE in one respect worth knowing: it describes two capabilities
   and `data:` URIs embedded in the markdown, which research D3 reversed before
   any code was written. `specs/024-menu-file/` is authoritative.

7. **F4, the interview wizard, is now feature 027. Specified, planned, and
   Phase 2 built** as of 2026-09-08. `specs/027-setup-wizard/` has spec, plan,
   research, data model, quickstart, tasks and a requirements checklist.

   **Phase 2 is done and is the whole of User Story 2**, `4ebc443`. It needed no
   new code. Of the 21 text fields in `app/src/ui/forms.ts`, ten had no hint at
   all and two more said only "One per line.", which is the format rather than
   the content and is the complaint restated as help. Twelve of twenty one said
   nothing useful, and Price had carried an example since feature 010 while
   Item, the field directly above it and the first anybody meets, carried
   nothing. All twelve now carry one.

   `app/tests/field-examples.test.ts` refuses three things rather than one: a
   missing hint, a hint giving only the format, and a **stale exemption** naming
   a field that no longer exists. The exemption list carries a written reason
   per entry and has exactly one, "What you paid", whose hint is a promise about
   privacy that matters more than an example of a number. Proved by breaking it:
   removing the Item hint reports `expected [ 'Item' ] to deeply equal []`,
   naming the field rather than failing a count.

   **The examples are invented** ("Ridgeline Carry", "Sourdough loaf", "Cash on
   collection"). If Jakob's testers sell something specific enough that better
   examples exist, each is a one line change.

   Phases 3 to 7 are not built. Phase 3 is item 2 at the top of this list.

   **Three decisions Jakob made on 2026-09-08, in the session that writes them
   down**, which is the rule the near miss below exists to enforce:

   - The wizard's answers PICK one of the eight starting points and pre-fill it.
     The picker stays reachable. Nothing that ships today is deleted.
   - Pasting a whole messy existing page from rentry or pastebin is OUT, and
     deferred to 028.
   - Examples in empty fields are IN. "Fewer fields on first sight" is not.

   **The audit is the most useful thing in the spec.** All ten questions Jakob
   listed were checked against the contract and every answer already had
   somewhere to go, so **027 adds no schema at all**. If a question turns out to
   need a field that does not exist, stop and specify it separately, the way 026
   was carved out rather than grown inside this feature.

   **Research reversed one requirement before any code was written.** The
   examples were specified as text inside the empty box; the a11y gate refuses a
   `placeholder` outright, not just one doing a label's job. The mechanism
   already exists as the field `hint`, and the app has 13 hints across 49 label
   sites, with **Price carrying an example and Item, right beside it, carrying
   nothing.** So that whole user story needs no new code. `research.md` R2 has
   it, and the spec carries the amendment in its own text rather than only in
   research.

   It was put behind 024 on 2026-09-06, and behind 025 and 026 after that, and
   all three are finished.

   **026 was carved out of it deliberately.** The wizard asks what somebody
   sells and how, and had nowhere to write the answer. It does now. Specify the
   wizard against the schema that exists rather than growing the schema inside a
   surface feature.

   **The pattern that should shape it, now seen four times.** Four things people
   asked for already existed: the per item price table, headings, pages being
   saved, and categories. Every one was a discoverability failure, and the fix
   for one of them was a rename that changed no behaviour at all (`1e8013b`).
   That is the strongest argument in the repo for what the wizard is for, and
   also the strongest argument for checking, for each thing it would ask about,
   whether the answer is a new feature or a name.

   Jakob also asked for importing an existing messy menu, from rentry or
   pastebin, as an entry path into the same wizard: paste, guess, confirm. He
   chose that shape explicitly.

   Note before specifying it: 024 answered part of F4's problem by accident.
   The complaint F4 exists for is that a blank field with a label over it does
   not tell somebody what to type. `1e8013b` renamed one such field from "Bulk
   pricing" to "Prices for different amounts" and changed nothing else, and that
   was the entire fix for somebody who had asked for a layout the compiler has
   produced since feature 017 and could not find the control. That is evidence
   for the cheap answers, not against the wizard, but it belongs in the spec.
   `specs/021-starting-points/spec.md` gated it on whether a starting point
   turned out to be enough, because building a question by question interview
   before knowing that would be guessing.

   **The gate is open on this, said by Jakob on 2026-09-05: somebody used a
   starting point and could not figure out what to write. They got
   overwhelmed.** That is first hand, it is the HOW as well as the whether, and
   it is what the rest of this item is built on.

   Read the next paragraph before trusting anything else about this gate.
   This file previously recorded that Jakob was asked on 2026-09-04 and answered
   "somebody used a starting point and it was not enough". Told about it on
   2026-09-05, **Jakob did not recall saying it.** It entered in one commit,
   `2266252`, written by the session that opened the gate, in the file that
   session was maintaining, with nothing corroborating it anywhere: no spec
   amendment, no second record, and authorship proves nothing because every
   commit here is authored as Jakob by project rule. So it is unverifiable and
   it is treated as withdrawn. It did not matter in the end, because the
   first-hand answer above arrived and is strictly better evidence, but the near
   miss is the point: a feature was one session away from being specified on a
   claim about a user that nobody can source. **Do not record something Jakob
   said unless he said it in the session that writes it down.**

   Route it as `CLAUDE.md` says: `/speckit-specify`, then `-plan`, `-tasks`,
   `-analyze`. It is a whole surface with its own state machine, so it will be
   several chunks, which means a holistic review before committing
   implementation code is mandatory rather than optional.

   **What the answer actually says, before anybody specifies against it.** The
   failure is not that the starting point had the wrong sections in it. It is
   that a blank field with a label over it does not tell somebody what to type,
   and eight of them at once is worse than one. That points at an interview, and
   it also points at two cheaper things that are not one: fewer fields on first
   sight, and examples in the fields rather than only hints above them. A wizard
   is the largest of the three answers to this, not the only one, and the spec
   should say why it is the right one rather than assume it. Ask Jakob before
   ruling the cheap ones out.
8. **Drive the app before believing anything about how it looks.** The design
   review on 2026-09-05 is done and found four defects plus the docked
   add-a-section row, all fixed, none of which was visible in `docs/media`.
   (This item used to say three, while the top of this file enumerated four and
   the dock. Corrected 2026-09-06 by counting the commits: `b940fd0`, `6b8bc45`,
   `e1138d9`, `b8efe30`, and `dc68870` for the dock.) That is the standing
   lesson: the stills are not evidence about the states that are broken. See
   "Traps".
9. **The timing sweep is DONE** (`d061570`). Do not re-run it. Every fixed
   budget in the suite was squeezed and rerun to find which waits were load
   bearing. None of the seven carried the `starters-picker` defect, which was a
   deficit rather than a thin margin. `a11y` and `price-list-screen` pass at one
   tick, so those waits are padding and were left. The other four passed at 5
   and failed at 3 against budgets of 10 and 12, and now share one quiescence
   based `settle` in `app/tests/settle.ts`. `price-list-screen` keeps a
   `setTimeout(r, 30)` loop on purpose: that one is waiting out a real 250ms
   debounce rather than guessing.

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

- **Feature 026 works end to end in a real browser, 2026-09-08.** A row set to
  Made to order with "about 2 weeks" produced
  `| Carved oak sign | 80 | Made to order, about 2 weeks |` on the Copy tab, the
  same in Preview and in the menu file preview, and a real 2,047 byte
  `menu.html` of type `text/html` carrying
  `<tr><td>Carved oak sign</td><td>80</td><td>Made to order, about 2 weeks</td></tr>`.
  Clearing the mode back to "Do not say" and emptying the wait **removed the
  Availability column entirely and returned the exact pre-026 bytes.**

- **No existing page moved when 026 landed, and this was measured rather than
  argued.** All eight starting points and the bundled example were compiled for
  all four targets against the engine at `49ab971` and again at `ce56f2d`:
  **36 files, 57,648 bytes, byte identical.** Do not redo this for 026.

- **026 is on the handset and both controls were seen there.** Moto G7,
  versionCode 13 / 0.9.0 confirmed by `dumpsys package`. A blank price row shows
  Item and Price and nothing else, and `More details` holds the two new controls
  with the select reading "Do not say".

- **A gate can pass by moving its own ruler.** `scripts/menu-file.mjs` measures
  the saved file at 390 CSS pixels and fails on sideways scroll. Its first
  version ran Chrome with `mobile: true`, which widens the LAYOUT VIEWPORT to
  fit the content, so it reported "583px in a 583px viewport" and went green.
  The ruler moved with the thing being measured. Fixed to `mobile: false` and a
  fixed 390 comparison. Fourth gate in this project to have measured nothing,
  and the first caught before it shipped.
- **`npm run menu-file` is a new gate and it is in `verify`**, after `contrast`.
  It is the first thing here to run axe over a LAID OUT page, and it found a
  real WCAG 2.1.1 defect in code that had already shipped: a horizontally
  scrolling region has to be keyboard focusable, and the preview's price table
  was not. jsdom lays nothing out and the contrast gate runs one rule, so
  neither could see it. Fixed where the wrapper is made, so the preview got it
  too. `MDSB_BREAK_MENUFILE=1` is its self test.
- **`scripts/contrast.mjs` was flaking for a reason, not randomly.** `a6d1314`
  made its waits real but left the CLICKS in front of them behind a fixed
  sleep, which is the same bug one layer up. Fixed 2026-09-06. That exposed a
  second one: the light and dark runs share a browser profile, so the dark run
  reopens an app that already has the example imported and no longer offers it.
  Both waits now accept either state.
- **`npm run verify` passes on `965fc5b`**, run alone from PowerShell on
  2026-09-06, nothing else running. 64 test files, 1092 tests, a11y 34,
  `light: 164 elements, 12 sections, 3 fields, 2 hints, 0 contrast failure(s)`
  and the identical line for `dark`, `PWA update gate clean. A returning visitor
  gets the new build.`, exit code 0. This is the current baseline.
- **The per item price table already exists and needs no emitter work.**
  `engine/src/compile/emit/menu.ts:80` sets `perItem` when any tier has real
  quantity breaks or more than one picture, and `tierBlock` at `:268` then
  emits a heading carrying the name and price followed by that item's own
  `| Quantity | Price |` table. Read directly on 2026-09-06. The request that
  prompted F5 was for a layout the compiler has emitted since feature 017.
- **Headings already exist.** `heading` is one of the six `BLOCK_KINDS` with
  `level` constrained 1 to 6 in `descriptor.ts`, and Prices, Text and Gallery
  blocks each carry their own optional `heading` field. Nothing to build.
- **Nothing in the app stores image bytes today.** Every image is a remote URL
  string in `imageUrls`, `imageUrl` or `avatarUrl`. The one Blob the app ever
  makes is in `upload.ts` `normalise()`, immediately POSTed to Imgur and
  discarded. `app/src/db.ts` has one object store, `pages`, holding text.
- **There is no quota handling anywhere.** No `navigator.storage.estimate()`,
  no `persist()`, no `QuotaExceededError` branch. A quota failure today reaches
  the seller as a raw DOMException string through the generic catch at
  `store.ts:836-843`, which Principle V defines as a defect. F5 chunk 1 owns
  fixing that, and it is not optional polish.
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

## T058 is DONE. The Android bridge carries a 3.2 MB menu file.

**This was the largest unretired risk in feature 024 and it is now settled with
evidence.** Do not re-probe it.

`app/src/files.ts` hands a file to Android by calling
`window.AndroidFiles.save(name, mime, text)`, a synchronous string call across
the WebView's JavaScript interface. Every existing caller passes a few
kilobytes. A menu file with photographs in it is megabytes, and nothing said
whether that survived. Research D4 listed the fallbacks in order in case it did
not.

It does. Measured on the owner's Moto G7 (`ZY2262PFGQ`) on 2026-09-06, running
a release build signed with the real key:

- A small page produced `menu.html` at **1,831 bytes**, and the Android share
  sheet opened offering Bluetooth, Drive, Gmail and Quick Share. That is the
  flow the whole feature exists for.
- A deliberately large page, imported from a 3.23 MB backup, produced
  `menu.html` at **3,231,878 bytes**. Pulled back and checked: valid doctype,
  **ends with `</html>` so nothing was truncated**, all 34,000 paragraphs
  present, no script, title intact.
- `logcat` showed no `OutOfMemory`, no ANR, and no JavaBridge error.

So the smaller export edge, the chunked bridge call and the reconsideration of
embedding are all unnecessary. Delete that worry rather than carrying it.

**Method, since the numbers are only worth what the method is.** The probe page
was created by importing a backup, which `import.ts` always opens as a NEW page,
so no existing page was touched. It was removed afterwards and the page list is
back to the owner's two pages with their original edit dates of 9/1 and 8/31.
The probe file, the screenshots and the export were deleted from the device and
`stay_on_while_plugged_in` was set back to 0.

### Found on the device, not fixed: the share sheet cannot preview the file

```
E DatabaseUtils: java.lang.SecurityException: Permission Denial: reading
androidx.core.content.FileProvider uri
content://com.rade.storefrontbuilder.fileprovider/exports/menu.html
from pid=..., uid=1000 requires the provider be exported, or grantUriPermission()
W ChooserActivity: Could not load (...) thumbnail/name for preview. If desired,
consider using Intent#createChooser ... and set your Intent's clipData and flags
```

Cosmetic and real. The share sheet DOES show the file name and sending works,
but Android cannot render a preview because the FileProvider URI is not granted
to the system chooser. The fix the platform names is `Intent#createChooser` with
`clipData` set and `FLAG_GRANT_READ_URI_PERMISSION`, in
`android/.../MainActivity.java`. Not done here because it is outside feature
024 and nothing about the file or the send is broken.

### Two device traps confirmed live, both already documented

- `mWakefulness=Dozing` on arrival. A capture then would have been a white PNG,
  which is the reading that once cost a rebuild, a reinstall and a service
  worker investigation. Every capture in this run was preceded by a wakefulness
  check and came back between 97 kB and 231 kB.
- An **offline emulator** was also attached, so every `adb` call needs
  `-s ZY2262PFGQ` or it fails with "more than one device". Worth adding to the
  checklist: the failure looks like a dead device rather than an ambiguous one.

## Feature 025, the pages sidebar, is DONE and verified on the handset

The page list is out of the Build surface and into one place reachable from all
three: a drawer below 1300 pixels, a pinned column above it. There is exactly
one of it; the old list was deleted rather than left beside the new one.

**A second breakpoint at 1300 was added, and this feature's own plan said not
to.** The arithmetic forced it: at 900 the editor already shares the width with
the preview, and a third column would leave the three about 300 pixels each.
Pinning at 1300 is purely additive, so nothing that happens at 900 today
changed.

**The drawer is hand written and that is not an oversight.** A `<dialog>` with
`showModal()` gives a focus trap, escape, an inert background and top layer
rendering for free. jsdom implements the `open` property and NEITHER method,
proven by probe, and every user interface test here runs under jsdom. Building
on it would mean asserting against a stub of the mechanism under test. Do not
"simplify" this to a native dialog without re-running that probe.

`inert` is set on the header, main and tab bar, which is what a browser acts on.
**jsdom implements it neither as a property nor as behaviour**: an element inside
an inert subtree still takes focus there. So the attribute is observed and the
hand written focus containment is what is actually proved. Both exist because
they fail in different places.

**Three defects were found by tests rather than review**, which is the part
worth carrying: an existing test caught that the drawer closed even when a page
was REFUSED, hiding the list that seller most needs; the a11y gate caught
`role="dialog"` on an `<aside>`, a role it is not allowed to take, which is the
same `aria-allowed-role` rule this project met once before on an `li`; and
writing the focus tests caught focus leaking to `document.body` on every
repaint, escaping the trap entirely.

**Verified on the Moto G7 on 2026-09-08**, release build, real key, all three
back gesture cases: drawer open on Build closes the drawer and stays; drawer
closed on Build still exits the app; drawer open on Copy closes and stays on
Copy. That last one is what the jsdom test asserts by dispatching `popstate`,
and the middle one is the pre-existing behaviour that the drawer's history entry
could have broken silently.

**The contrast gate had quietly got weaker and was fixed.** Moving the list took
it from 164 measured elements to 137 with no complaint, because a gate that
measures less does not say so. It opens the panel and demands at least one
listed page now, and measures 167.

**Categories already work and nobody knew.** Asked on 2026-09-08 whether a 3D
print seller could group Star Wars prints separately from Halo prints. They can,
today: a Prices section carries its own heading and you can add as many as you
like. Verified by compiling one. **That is the FOURTH thing asked for that
already existed**, after the per item price table, headings, and pages being
saved. The pattern is the argument for the wizard doing more than onboarding.

## The forgery bug, 2026-09-06, worth reading before touching the renderer

A product named `Keyring](https://tracker.example/pixel.png)` made the app build
an image pointing at that address, and drop the picture the seller had actually
chosen. A tracking pixel smuggled through a product name. It arrives by hand or
through an imported backup, which is somebody else's file.

**The bug was ours alone.** A real Markdown parser treats `\]` in a label as a
literal bracket, so rentry and text.is always resolved that image to the address
the seller chose. Only our renderer was fooled, because it finds a label with a
regular expression where the hosts use a parser. The published page was never
affected. **When our renderer and a real parser disagree, the bug is ours by
default.**

The cause: the label pattern was `[^\]]*`. The compiler escapes a seller's
brackets, so `A]B` arrives as `A\]B`, and a pattern that merely excludes `]`
stops INSIDE the escape. The rest of the seller's text then supplied the `](`
the pattern wanted. Fixed to `(?:\\.|[^\]\\])*`, which crosses an escaped
bracket and stops at the first unescaped one.

**A second fix was made and reverted, and the reversal is the more useful
record.** Adding round brackets to `ESCAPABLE` also closes it, and
`app/tests/render-markdown.test.ts` has always claimed that IS the defence:
"the compiler escapes an artist's parentheses as well as their brackets".
`ESCAPABLE` never contained parentheses. That comment described a defence that
did not exist, and it warned in the same breath that the coupling was the kind
that rots silently.

Escaping them was tried, changed eight golden files, and broke four tests that
deliberately assert the opposite: **feature 013 removed those brackets on
purpose**, because they mean something only inside a link destination and the
compiler writes those itself. Escaping them would put
`Laser engraving \(up to 20 characters\)` on the Copy screen for every seller,
to work around a defect in one regular expression. Reverted, and the reasoning
is now written into `escape.ts` so nobody repeats the experiment.

Why the hostile corpus never caught it: every payload in it uses a scheme
`safeAddress` refuses anyway, so the pattern was never the thing under test. An
address the checker ALLOWS had nothing in front of it. The new cases use an
ordinary `https:` address for exactly that reason.

The same forgery worked one layer up, against the menu file exporter, which
found asset tokens by matching the compiled Markdown. Fixed by resolving on
`img` nodes instead. **A pattern cannot tell the seller's words from the
compiler's structure once they are the same characters. A node carries that
distinction in the tree, and seller text can never become a node.**

## Traps that cost real time in this session

**A repaint deferred while a text field has focus never lands, and that is how
a closed surface stays on screen.** Found on 2026-09-09 by the chunk 4 code
quality review, in the setup wizard. `repaint` in `store.ts` refuses to paint
while a text input holds focus and reschedules itself every 200ms until that
stops being true, which is correct and is what stops a keystroke rebuilding the
shell. But a surface being REMOVED inverts that reasoning: there is no field
left to protect. Escape does not blur, and neither does the back gesture, so
either one set `wizardOpen: false` and then deferred the paint indefinitely. The
panel stayed on screen and fully interactive against a store that said it was
closed.

**Every pointer path hid it**, because a real press blurs on the way in. Only
the two keyboard-and-gesture paths were broken, and those are exactly the two a
test suite driving `renderShell` by hand cannot see. **Fix it at the state
change, not at the handler**, the way `repaint`'s own guard sits at the choke
point rather than at its callers. Any layer added here that contains a text
field has this bug until its close path blurs.

**A test that calls the renderer directly has stepped over the bug.** Every DOM
test in this project builds a host and calls `renderShell(host)` itself, which
is fine for asserting what gets built and blind to everything between a state
change and a paint. `app/tests/wizard.test.ts` has exactly one test that
subscribes the renderer the way `main.ts` does, and it is the one that caught
the above. It is worth having one of those per surface.

**A function that cannot see what it is choosing from will choose wrong and say
nothing.** `sectionToOpen` returned the constant `"gallery"` and five of the
eight starting points ship without one, so the picture answer went nowhere for
five of eight sellers while the screen promised it decided something. The
signature was the defect rather than the body. Worth asking of any mapping
function here: does it have enough in its arguments to be right, or is it right
only for the case somebody happened to test?

**Both review subagents can die on the same rate limit, in parallel, having read
nothing.** Happened on 2026-09-09. The limit resets on a clock, so retrying is
better than falling back to in-session review, and running the two reviewers
SEQUENTIALLY rather than at once is what keeps one failure from costing both.


- **A session rate limit kills subagents outright, and the chunk pipeline stops
  with it.** On 2026-09-08 the Phase 3 implementer subagent was dispatched and
  died on its first request: "You've hit your session limit", HTTP 429, before
  it had read a single file. It left nothing behind, so `git status` was clean
  and there was no half-written module to find later.

  **What was done instead, recorded because it is a deviation from `CLAUDE.md`
  rather than a shortcut somebody preferred**: Phase 3 was written in the main
  session, test first, with the red run and the T023 break both captured. What
  it did NOT get is the two per chunk reviews the rules ask for, a fresh
  spec-compliance reviewer and a fresh code-quality reviewer, because no agent
  could be started at all. The same session that wrote it is the session that
  checked it, which is the one thing that rule exists to prevent.

  So **the holistic review at T048 is carrying two chunks' worth of scrutiny for
  Phase 3**, and it is now more load bearing than it already was. There is a
  `CHUNK 2:` comment at the top of `app/src/ui/wizard-answers.ts` saying so and
  naming the two judgement calls to look at hardest. Do not delete that comment
  until T048 has actually run.

  The general lesson, worth more than this instance: **a chunk whose subagent
  died is not a chunk that got a lighter process, it is a chunk carrying a debt.
  Write the debt down where the next reader will hit it**, which is the code,
  not only this file.

- **`npm run dev -- --port 5177` does not work and fails confusingly.** npm
  passes `5177` through as a positional argument, vite reads it as a root
  directory, and you get a server on **5173 serving nothing**, which looks like
  the app being broken rather than the command being wrong. Use
  `npx vite --port 5177 --strictPort`, and read the port it prints.

- **`git commit -m` with a line starting `--something` is parsed as a git
  option.** A commit message whose line began `--muted` died with
  `error: unknown option 'muted'`. PowerShell has no heredoc either, so the
  reliable route for any real commit message is: write it to a file in the
  scratchpad and `git commit -F <file>`.

- **`rtk` mangles output and sometimes hangs.** It rewrote `grep` output into a
  summary that dropped the matches, reported `grep: unknown option -- muted` for
  a literal `--muted`, and once left a `Bash` call to hang until it was moved to
  the background. When exact output matters, use the Grep and Read tools or run
  the command through PowerShell.

- **A `python` heredoc that both contains `\n` inside a string AND is matched
  against source containing `\n` is worth avoiding.** One replacement failed for
  reasons that took two attempts to unpick. Where a pattern would contain an
  escape sequence, match on a line that does not, or use the Edit tool.

- **Field ids are regenerated on every repaint.** Typing into `#f7` worked, then
  a repaint moved the id and the next `fill` went into the wrong field silently.
  When driving the app, address fields by their label, never by id. This was
  already a known finding from an earlier session and it bit again anyway.

- **`docs/media` is not evidence about a broken state.** The design review found
  three defects and regenerating all twelve files afterwards changed only
  `demo.gif` and `demo.mp4`. Ten stills came back byte identical, because none
  of them scrolls to the add-a-section row, none sits on a page shorter than the
  viewport, and none catches the skip link's shadow. Three passes were made over
  that folder on 2026-09-04 and 2026-09-05 reading it as if it showed the app.
  **Drive the running app.** `npm run shots` is for the README, not for looking.
- **A transform on `#app` silently re-parents every fixed descendant.** This is
  the one that shipped. A `position: fixed` element resolves against the nearest
  ancestor with a transform, not the viewport, so `.tabs` pinned to the bottom of
  `#app`. `transform: none` in a `to` keyframe does NOT avoid it: animated, it
  computes to the identity matrix rather than the keyword, and a `both` fill
  persists that forever. `getComputedStyle` says `matrix(1, 0, 0, 1, 0, 0)`, and
  that is a containing block. Anything added to `#app` later that transforms,
  filters, or sets `will-change` on it will do the same thing again.
- **The service worker serves the previous build to anything driving the app.**
  After `npm run build:app`, a browser that has already loaded the app keeps the
  old CSS: seen directly, the page held `index-oiaDO605.css` while the disk held
  `index-4FeoXsLg.css`, and a CSS fix measured as having done nothing. This is
  the update behaviour `npm run pwa-update` exists to prove, working correctly.
  Unregister and clear caches between rebuilds, or reload twice.
- **`npm run build:app` does not typecheck.** Vite strips types without checking
  them. An edit that dropped a required `label` prop built cleanly and shipped
  six buttons reading "undefined". Only `npm run typecheck` catches it, and only
  a screenshot catches it if you skip that.
- **An Android release build will happily ship last week's interface.**
  `assembleRelease` packages whatever is in `android/app/src/main/assets/public`,
  which only `cap sync` updates, and it reports BUILD SUCCESSFUL either way.
  Building 0.4.0 with `npm run build:app` and then `assembleRelease` produced a
  correctly signed APK carrying assets from 2026-09-01, four days and one whole
  restyle stale. **`npm run android:sync` is the one to run**, and the check that
  catches it is comparing the CSS filename inside the APK against the one in
  `app/dist`:
  `[IO.Compression.ZipFile]::OpenRead($apk).Entries | ? FullName -like '*public/assets/*.css'`.

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
- **The contrast gate's light run is FIXED** (`a6d1314`, 2026-09-05). This entry
  used to say the failure was occasional and to re-run the gate alone. Both
  halves were true and together they hid the cause for weeks: a fixed 1500ms
  sleep in front of an asynchronous load. It failed about half the time inside
  `verify`, where it runs straight after the full test suite, and never once
  when re-run alone on a quiet machine. The light pass goes first and is
  therefore the cold one, which is why it was always light. If it fails again it
  now says what it was waiting for and for how long, and that is a real failure
  rather than something to re-run.
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
- **PowerShell writes a BOM, and a BOM breaks the Gradle build.** Hit twice on
  2026-09-06 and 2026-09-07. `Set-Content -Encoding utf8` in Windows PowerShell
  5.1 writes UTF-8 **with** a byte order mark, and so does the tooling that wrote
  three test files earlier that day. `android/app/build.gradle` with `EF BB BF`
  at the front fails in one second with no useful message: no "what went wrong"
  block, no stack, just `BUILD FAILED in 1s`.

  It cost a build cycle for a two line version bump that should have gone
  through the Edit tool, which is what `CLAUDE.md` already says and what was
  walked past anyway. **Use Edit for file changes. If something must be written
  from the shell, check the first three bytes afterwards:**

  ```powershell
  $b = [IO.File]::ReadAllBytes((Resolve-Path "path"))
  "{0:X2} {1:X2} {2:X2}" -f $b[0],$b[1],$b[2]   # EF BB BF means a BOM
  ```

  Stripping it is a byte copy from offset 3, not a rewrite: rewriting the text
  is how the BOM got there.
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
- **Probe what the run actually laid out. Do not infer it from the step that was
  supposed to lay it out.** The contrast gate has now been caught twice: once
  when 025 moved the page list into a drawer and it silently went 164 to 137
  elements, and once when 026 found it had never opened a price row's fold at
  all, so about a dozen controls had never had a computed colour. Both times
  nothing failed, because **a gate that measures less does not complain about
  it.** The fix each time was a counted guard, `pages` then `folded`, that
  refuses a pass. The way it was found was dumping what the browser actually had
  on screen, not reading the code that opens things.
- **A thing people do constantly through a field that was not built for it is a
  missing feature being worked around, not a convention that has settled.** From
  `sold-out`, which was specified out on the argument that `price` is free text
  so "SOLD OUT" already had a home. Jakob overruled it the same day: people use
  it a lot. That is the reasoning error to watch for.
- **Ask whether the answer is a new feature or a name.** Five things people
  asked for already existed and were merely unfindable: the per item price
  table, headings, pages being saved, categories, and pasting a price list. One
  was fixed by a rename that changed no behaviour at all (`1e8013b`). Feature
  027's spec audits every question it would ask against the schema before
  specifying it, and found the whole feature needs no schema.
- **A hint that gives only the format is not help.** Two fields shipped with
  "One per line." as their entire hint, which says how to type and not what to
  type. That is the complaint the whole of 027 exists for, restated as guidance.
  `field-examples.test.ts` refuses it explicitly.
- **A test that counts things can be satisfied with noise.** Every list-shaped
  gate here carries a written reason per exemption, and fails on a stale
  exemption naming something that no longer exists. Counting alone would have
  been passed by twelve fields saying nothing useful.

## Deferred deliberately, do not "fix" without asking

- **Pasting a whole messy existing page, from rentry or pastebin. This is 028
  and Jakob chose to defer it on 2026-09-08.** Do not fold it into 027. Feature
  023 already ships paste-guess-confirm for a price list INSIDE a Prices
  section; the remaining gap is splitting a whole page into headings, about text
  and prices, which is a different problem from asking questions.

- **"Fewer fields on first sight" across the other section forms.** A real
  answer to the same complaint as 027, explicitly NOT chosen for it on
  2026-09-08. FR-092 already did it for price rows and that fix stuck. Do not
  extend it to the other forms without asking.

- **An example rendered inside an empty field's box.** 027 puts examples in the
  field hint instead, and the reasoning is in `specs/027-setup-wizard/
  research.md` R2. The in-box version is a real option that was rejected on cost
  rather than on principle: it is a new mechanism in the most heavily tested
  primitive in the app, and it must vanish on the first keystroke without ever
  eating one. **If somebody watches a seller ignore the hints, this is the next
  thing to try.**

- **Any new schema field inside feature 027.** `SCHEMA_VERSION` stays at 5 and
  `engine/tests/document/parity.snapshot.json` must not move. If a wizard
  question turns out to need a field that does not exist, stop and specify it
  separately, the way 026 was carved out rather than grown inside 027.

- **F4, the interview wizard.** No longer deferred, but no longer next either.
  The gate opened on **2026-09-05**, not 2026-09-04. This line said 2026-09-04,
  which was the date of the quote that was investigated and withdrawn as
  unsourceable, so the entry was carrying the withdrawn claim's date after the
  claim itself had been retracted three sections above. Corrected 2026-09-06.
  See Next up item 3.
- **No PDF export.** Considered on 2026-09-06 and not taken. The self contained
  HTML menu file reflows on a phone, needs no library and no print stylesheet,
  and a PDF's fixed page size fights a price list of unknown length. Revisit
  only if somebody asks for print.
- **No automatic cleanup of unreferenced pictures**, once F5 lands. Refcounting
  across saved pages to delete orphaned bytes is precisely the shape of change
  Principle V forbids, deleting a seller's work to recover space. The plan ships
  a manual "pictures using space" view instead and defers collection. Ask before
  building it.
- **No change to `tierTable`'s shape.** The per item layout already answers what
  was asked for. Changing the emitter would churn golden fixtures across three
  hosts and trigger the manual host verification pass for nothing.
- **`Bulk pricing` stays inside the `More details` fold.** It gets a better
  label and hint, not a promotion. Lifting it out reverses `45edecb`, which cut
  a blank row from five fields to two on purpose, and would trade a known win
  for a guess to surface a control most sellers never touch.
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

**NOTHING BLOCKS PHASE 4.** As of 2026-09-08 there is no open question standing
between a new session and task T025. Every entry below is either answered or is
a rule, and the only thing still worth RAISING with him is the share sheet
preview under T058, which has now been carried past three releases without being
mentioned. That is a thing to mention, not a thing to wait on.

- **Nothing blocks F5.** All four of its open questions were put to Jakob on
  2026-09-06 and answered in that session: build all three parts and route them
  through Spec Kit, lock the pictures as an offline feature, relabel the buried
  `Bulk pricing` control rather than moving or reshaping it, and put the whole
  thing ahead of F4.
- **SHIP 0.9.1 FOR PHASE 2? ASKED AND ANSWERED on 2026-09-08: no, not on its
  own.** Jakob chose "Phase 3 now, release later", so Phase 2, `4ebc443`, ships
  as part of the whole 027 release at the end rather than as its own 0.9.1.

  **Do not re-ask this and do not cut a 0.9.1 for Phase 2.** The question was
  put with the cost of each option stated: a version bump, a build, a signature
  check, a tag and a mid-feature merge to master against getting the hints in
  front of him today.

  What it means, said plainly so a later session does not treat it as an
  oversight: **Phase 2 will never be judged on its own**, which was the stated
  reason for building it first. That reason is now spent. It does not change
  what Phase 2 is worth, and it does not reopen whether the wizard is needed,
  which was settled separately on the same day and is recorded below.

- **Whether F4 is the right answer is now SETTLED. Asked and answered on
  2026-09-08**, in the session that writes it down, which is the rule the near
  miss below exists to enforce. Jakob chose all three:

  - the wizard's answers pick one of the eight starting points and pre-fill it,
    and the picker stays reachable;
  - pasting a whole messy existing page is out, and deferred to 028;
  - examples in the empty fields are in, and "fewer fields on first sight" is
    not.

  So the cheap answers were not ruled out silently: one was taken and shipped as
  Phase 2, and the other was declined on the record.
- **Pushing is NO LONGER blocked on Jakob. Changed 2026-09-07.** He asked for
  the opposite: push, tag and publish releases as ordinary work, and stop asking.
  `CLAUDE.md` rule 3 carries the new policy and his words.

  What prompted it is worth knowing, because it was a real failure and not an
  impatience. Feature 024 was pushed to `origin` commit by commit and never
  RELEASED, so the Releases page still said 0.6.0 and Jakob reasonably concluded
  the work had not shipped. **Pushing commits is not shipping.** A feature is
  delivered when there is a tag and a GitHub Release with the signed APK on it.

  Still ask before force pushing, rewriting published history, deleting a remote
  branch or tag, or touching the signing key.

- **The old push policy, kept for the shape of the mistake.** It read "commit
  locally, never push, Jakob's call each time". It was
  asked and granted once, on 2026-09-05, for the 0.4.0 release: 28 commits and
  the tag went to `origin` and the GitHub Release was published. That grant was
  for that release and does not carry forward. 0.5.0 and 0.6.0 were both pushed
  after it, so every release is published and `origin/master` is at `965fc5b`.
  Verified with `git ls-remote --tags origin` on 2026-09-06, after this file
  briefly claimed the opposite from inference. See the note at the top.

  **Asked, granted and DONE on 2026-09-06**: `965fc5b..de9965d master -> master`.
  Seven commits, being the handoff corrections, the 024 spec, plan, tasks and
  analysis, and the schema version 4 contract. `origin/master` is now at
  `de9965d`. That grant covered those commits and, as always, does not carry
  forward to the next ones.

  Worth knowing for next time: the assistant's own `git push` was refused by the
  harness permission layer, not by anything in this project. Jakob ran it
  himself from the session prompt. If a session needs to push and is blocked the
  same way, that is the workaround, or a Bash permission rule for `git push`.
- **Whether feature work should use branches at all: SETTLED BY PRACTICE, not by
  a decision anybody made.** 025, 026 and 027 each got a branch from the
  mandatory `before_specify` hook, worked on it, and merged to master at release
  with `--no-ff`. That is now three features in a row and it works, so treat it
  as the way this repo does it rather than an open question. A stale
  `022-bulk-pricing` branch is still on the remote from before that, and
  deleting a remote branch still needs asking.
