# Research: The menu file

**Feature**: 024-menu-file
**Date**: 2026-09-06

Six decisions. Two of them reverse what the approved plan document said, and
both reversals came from reading the code rather than from thinking harder, so
they are recorded with what was read.

---

## D1: The saved file is HTML, not PDF

**Decision**: A single self contained `.html` file.

**Rationale**: It reflows, which a price list of unknown length needs and a
fixed page size fights. It needs no library, so the engine's zero runtime
dependency rule and the app's near zero one both hold. And it can reuse the
renderer the preview already uses, which is what makes Principle VII's
"the preview must show the compiled output" hold for the file too, for free.

**Alternatives considered**:

- **PDF.** Previews inline in more messaging apps, which is a real advantage.
  Rejected: page breaks through a price table, a rendering library in the
  bundle, and on a phone the print dialog route is rough. Recorded as a
  deferral rather than a refusal, in `docs/HANDOFF.md`.
- **A tall PNG.** Pastes anywhere with zero friction. Rejected: not text, so it
  is unsearchable and unreadable to a screen reader, which Principle VI makes a
  non starter.

---

## D2: The saved file is a host, and gets a target record

**Decision**: Add `MENU_FILE` to `engine/src/compile/targets.ts`, with one new
capability, `localImages`, which every paste host has as `false`.

**Rationale**: Principle II already says a host is a target record of capability
flags plus golden fixtures, and that adding one must not touch `emit/`. The
saved file is rendered by our own renderer, so it is a host whose behaviour we
can observe more precisely than any of the three we already carry. Making it a
target means the offline boundary is a data value the emitters read exactly as
they read `tables`, rather than a special case in code or a label in the
interface that somebody has to notice.

`capabilities.ts` states the bar: "A capability only exists once an emitter
consults it and a fallback test proves what happens when a host lacks it."
`localImages` clears it. The fallback is defined by FR-080: drop the picture and
raise `local_image_unsupported` naming it.

**`MENU_FILE` is deliberately NOT added to the `TARGETS` array.** `TARGETS`
feeds `findTarget` and the host picker on the Copy surface, and "Menu file" in a
list of places to paste your page would be a lie. It is exported by name and
compiled against explicitly, exactly as `PORTABLE` already is for the `.md`
file under FR-035. A page whose stored `target` somehow reads `menu-file` then
falls back to `PORTABLE` with a warning, which is the safe direction.

**Consequence for the existing test.** `cost-never-published.test.ts` iterates
`TARGETS`, so it will not see `MENU_FILE`. That is correct for `cost`, which
must never publish anywhere, so the new target needs adding to that test
explicitly rather than inherited. Noted here because it is exactly the kind of
gap that makes a gate measure nothing, which this project has already been
caught by twice.

---

## D3: Local pictures travel as an identifier in the markdown, never as bytes

**Decision**: For a target with `localImages: true`, the emitter writes an
ordinary Markdown image whose address is `mdsb-asset:<id>`. The app swaps those
for the real image bytes on the rendered DOM, after the markdown has been
turned into elements and before the file is serialized.

**This reverses the approved plan**, which said the app would resolve assets to
`data:` URIs first, build a derived `Document` carrying them, compile that, and
add a `dataImages` capability so that both `isSafeUrl` and `safeAddress` would
let a `data:` address through. Three things read in the code killed it:

1. **It would have put megabytes into the markdown string.** `compile.ts` counts
   the compiled output in bytes and warns against a host's stated limit. Feeding
   base64 photographs through that makes the count meaningless and makes
   `renderMarkdown`'s line by line parse chew through multi megabyte single
   lines. The identifier form keeps compiled output the size it has always been.
2. **It would have opened `data:` in both address checks.** `link.ts` is
   explicit that `isSafeUrl` is an allow list "because the set of dangerous
   schemes is open ended and browsers keep adding to it, while the set of
   schemes an image can arrive over is two". Widening that allow list to serve
   an export is precisely the trade the file argues against. The identifier form
   needs no widening at all: bytes never pass through either check, because they
   are attached to a DOM node the app built itself, from its own storage, not
   parsed out of text.
3. **A derived `Document` is a second document.** Building one to compile means
   a value that looks like the seller's page but is not it, passing through
   `serializeDocument`-adjacent code paths. Nothing good comes of that near a
   contract this project guards as hard as this one.

**Why `mdsb-asset:` is safe as a scheme.** It is not a scheme any browser
implements, so an unresolved one is an image that fails to load and nothing
else. It cannot execute. `render-markdown.ts`'s `safeAddress` still refuses it
by default and gains a narrow, explicit allowance, keeping the deliberate
duplication between the two checks that `link.ts` and `render-markdown.ts`
document: breaking that coupling once produced seven live `javascript:`
addresses.

**Alternatives considered**:

- **`data:` URIs in the markdown.** Above.
- **Post-processing the serialized HTML string with a regex.** Rejected outright:
  string surgery on markup is how this class of feature grows an injection bug.

---

## D4: The bytes reach the file through the DOM, and the size risk is on the bridge

**Decision**: Resolve `mdsb-asset:` images by setting `img.src` on the built DOM,
then serialize. Measure the resulting file across the Android bridge before
trusting it, and enforce a ceiling with a named message if it does not hold.

**Rationale**: `app/src/files.ts` hands a file to Android by calling
`window.AndroidFiles.save(name, mime, text)`, a synchronous string call across
the WebView's JavaScript interface. That is a very different proposition for a
five megabyte string than for the few kilobytes every existing caller passes.
The file's own comment records that both export buttons once silently produced
nothing on a real phone, so this route has already failed quietly once.

This is listed as a thing to measure rather than a thing to assume, and it is
the single most likely place this feature breaks on the owner's actual device.

**If it does not hold**, in order of preference: reduce the export edge for
embedded pictures below the 1600px the upload path uses, since a menu read on a
phone does not need print resolution; then chunk the bridge call; and only then
reconsider embedding. FR-077 already requires the seller be told the size at
save time, so the ceiling has somewhere honest to surface.

---

## D5: Reuse `normalise()` rather than write a downscaler

**Decision**: Store pictures through the existing `normalise()` in
`app/src/upload.ts`.

**Rationale**: It already canvases to a 1600px longest edge at 0.85 quality,
which is the size policy this app has shipped for a year, and re-encoding
through a canvas discards the EXIF block as a side effect. That side effect is
how FR-083's location and camera privacy requirement gets satisfied without any
new code, and a hand written stripper would be strictly worse.

**Alternatives considered**: storing the original bytes and stripping EXIF
explicitly. Rejected: more code, larger files, and it invents a second size
policy for the same product.

---

## D6: No automatic cleanup of unreferenced pictures

**Decision**: Ship a view showing what each picture costs and letting the seller
remove ones they choose. Never remove one automatically.

**Rationale**: Principle V: "No failure path MUST ever delete or overwrite a
user's saved document in order to recover." Refcounting pictures across every
saved page to reclaim orphans is a delete-on-a-heuristic, and the heuristic runs
against pages the seller may be about to reopen. `db.ts` already states that its
one delete "is reached only from an explicit action by them. Nothing calls this
to recover from an error." The same rule extends here.

**Cost, stated rather than hidden**: a seller who removes a picture from a page
leaves its bytes on the device until they clear it themselves. That is a real
cost and it is the right one to pay.

**Alternatives considered**: reference counting with deletion on save. Rejected
above. Recorded as a deliberate deferral in `docs/HANDOFF.md` so a later session
does not "fix" it.

---

## Answered by measurement. Both were open; neither is now.

- **How large a menu file the Android bridge will actually carry.** D4.
  **Settled 2026-09-06 on the owner's Moto G7**, release build, real signing
  key: a page imported from a 3.23 MB backup produced `menu.html` at
  **3,231,878 bytes**, valid doctype, ending in `</html>` so nothing was
  truncated, all 34,000 paragraphs present, and no `OutOfMemory`, ANR or
  JavaBridge error in `logcat`. So D4's fallbacks, a smaller export edge, a
  chunked bridge call and reconsidering embedding, are all unnecessary.
  `docs/HANDOFF.md` says do not re-probe it.
- **Whether serializing the rendered DOM is inert across the hostile text
  corpus.** The approved plan records a disagreement with an exploration agent,
  which held that reading markup out of the preview renderer surrenders its
  no-markup-string guarantee. **Settled by `app/tests/menu-file-hostile.test.ts`,
  72 tests**, which produces files and inspects them rather than reading the
  code that makes them, and which was verified to fail when the serializer was
  made to write one seller field as markup. The export did not need its own
  emitter. The corpus also grew by two cases for the `<title>`, which is RCDATA
  and which no existing payload closed an element to reach, and those two are
  what caught the deliberate break.

Left standing because a reader arriving here should see that these were real
questions answered with evidence, rather than find a section that quietly
disappeared once it became inconvenient.
