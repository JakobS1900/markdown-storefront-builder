# Handoff

The live document a new session reads first. `CLAUDE.md` still points at
`specs/README.md` for what each feature is; this file is only about what is
happening right now and what to do next.

**Released**: `v0.6.0`, from `965fc5b`, versionCode 9. `v0.5.0` is `9f1ab0c`,
versionCode 8. **Both tags are on `origin`**, and `origin/master` is at
`965fc5b`, so every release through 0.6.0 is published.

This line said the opposite for part of 2026-09-06: that 0.5.0 and 0.6.0 were
tagged locally only and nobody outside this machine had them. **That was wrong
and it was written here without being checked.** It came from reading an earlier
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
only the handoff still knows. Note it does NOT grant the push: that is still
asked for every time.

**Current state**: this file describes the tree at `965fc5b`, and
`npm run verify` is green on it, run alone from PowerShell on 2026-09-06:
**64 test files, 1092 tests, a11y 34, contrast 164 elements and 12 sections with
0 failures in both light and dark, pwa update gate clean, exit code 0.**

Note the test count. This file said to expect 1081 and it is 1092, because two
feature commits landed after the last handoff update and this file was not
touched for either: `45edecb`, a blank price row asks for two things rather than
five, and `4404756`, no bulk pricing controls until there are at least two rows
to choose between. Both shipped, both tagged, neither recorded here until now.
That is exactly the drift this project has already paid for twice, and it is
worth one line of warning: **update this file when a feature lands, not when
somebody remembers.**

Before those, feature 023 completed as `fa8eb28`, feature 022's missing holistic
review ran (`b69266a` the test, `20d3192` the findings), two directly requested
UI fixes landed (`e0f345b` the preview table and the checkbox, `053bdae` the
regenerated screenshots), and `4d26e5f` fixed a real test failure that
`npm run verify` caught on 2026-09-05, described under "Traps".

The restyle that was sitting uncommitted is now `a3998c3`, with the twelve
regenerated media files as `a9ecb4d`. **Working tree clean, nothing pushed.**

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

1. **Run `npm run verify` from PowerShell before anything else.** It is the
   check that tells you whether the tree is actually where this file says it is.
   Expect 1081 tests, a11y 34, contrast clean in both palettes, pwa gate green.
   If it fails, read "Traps" below before believing it: several of its failures
   are environmental rather than real. It earned its place on 2026-09-05, when
   it caught a real failure that had been latent for days and was NOT one of
   the environmental ones. See the starters-picker entry under "Traps".

   Done on 2026-09-06 at `965fc5b`, green, numbers quoted under "Current state".

2. **Release 024, or decide not to.** The feature is done and the tree is green.
   What is outstanding is a version and a tag, and both are Jakob's calls.

   The phone currently carries `0.7.0-dev`, versionCode 10, which was bumped so
   that unreleased work would not sit on the owner's device labelled as the
   released 0.6.0. A real release means choosing the version, tagging it, and
   asking about the push. `docs/RELEASE.md` has the policy, and "tag often" is
   the standing instruction.

   Also worth putting to Jakob before tagging: the FileProvider preview finding
   under T058 below, which is a two line change in `MainActivity.java` and is
   the only thing anybody will notice about the share sheet.

3. **F5, the menu file, was the previous feature and is DONE.**
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

4. **F4, the interview wizard, is UNGATED and is now the next FEATURE**, once
   the release decision above is made. It was put behind 024 on 2026-09-06 and
   024 is finished.

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
5. **Drive the app before believing anything about how it looks.** The design
   review on 2026-09-05 is done and found four defects plus the docked
   add-a-section row, all fixed, none of which was visible in `docs/media`.
   (This item used to say three, while the top of this file enumerated four and
   the dock. Corrected 2026-09-06 by counting the commits: `b940fd0`, `6b8bc45`,
   `e1138d9`, `b8efe30`, and `dc68870` for the dock.) That is the standing
   lesson: the stills are not evidence about the states that are broken. See
   "Traps".
6. **The timing sweep is DONE** (`d061570`). Do not re-run it. Every fixed
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

- **Nothing blocks F5.** All four of its open questions were put to Jakob on
  2026-09-06 and answered in that session: build all three parts and route them
  through Spec Kit, lock the pictures as an offline feature, relabel the buried
  `Bulk pricing` control rather than moving or reshaping it, and put the whole
  thing ahead of F4.
- **Whether F4 is the right answer**, not whether the problem is real. The
  problem is confirmed first hand on 2026-09-05: somebody could not figure out
  what to write and got overwhelmed. What is not settled is that a wizard is the
  fix. Fewer fields on first sight, and examples inside the fields rather than
  hints above them, address the same complaint for a fraction of a new surface
  with its own state machine. Jakob has not been asked to choose. Unlocks
  specifying whatever wins.
- **Pushing anything.** Still the policy, and still asked each time. It was
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
- **Whether feature work should use branches at all.** Delivery has gone
  straight to master since `Merge 009-imgur` on 2026-08-25, but
  `.specify/extensions.yml` still runs a mandatory branch-creating hook before
  every spec. This session created `023-import`, committed to master as
  instructed, and deleted the branch. A stale `022-bulk-pricing` branch is still
  there from the last time nobody decided.
