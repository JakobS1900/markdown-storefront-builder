# Markdown Storefront Builder: Validated Design

Date: 2026-08-15
Status: Approved. Input to `/speckit-constitution` and `/speckit-specify`.

## 1. The problem

Artists and freelancers use Markdown paste hosts (rentry.co and similar) as free
storefronts, commission menus, and art showcases. They do not know Markdown, get
overwhelmed, and pay someone else to hand-write the page for them.

Two facts shape the product:

1. Each host renders a slightly different Markdown dialect, so a page that looks
   right on one breaks on another.
2. Not every site commonly named in this space renders Markdown at all.
   Pastebin, Hastebin, and Ghostbin are plain-text and syntax-highlighting paste
   sites, and will display literal asterisks rather than bold. They are a
   different problem, and are out of scope.

## 2. What we are building

A mobile-first PWA where an artist assembles a page from a small set of blocks
and receives Markdown that renders correctly on their chosen host. No Markdown
knowledge required, no middleman.

Scope decisions already made:

| Decision | Choice |
|---|---|
| Primary audience | Both hiring managers and real artists, engine first |
| Host targets | Two: `rentry` and `portable`, a CommonMark plus GFM baseline. See `docs/research/2026-08-15-host-verification.md` |
| Blocks in v1 | Menu and pricing, gallery, ToS and policies, about and links |
| Images | Both paste a URL and upload, upload as an optional layer |
| Mobile | Responsive web plus PWA, one codebase |
| Architecture | Engine as a standalone library, static PWA, one thin upload proxy |

## 3. The core insight

This is a compiler, not an editor. Blocks become a document model, which a
per-host emitter turns into Markdown, governed by a declared capability matrix,
with a lint pass that warns the artist before they publish.

The lint pass is both the product's selling point and the artifact a reviewer
can read in ten minutes and judge. It is the deterministic, pure, testable core
with a narrow input gate.

## 4. The engine

One entry point, pure, with no DOM and no network:

```ts
compile(doc: Document, targetId: TargetId): { markdown: string; diagnostics: Diagnostic[] }
```

### Document

Plain JSON: a `schemaVersion`, page metadata, and an ordered list of blocks.
Every block is a tagged union member. Because it is plain data it serializes to
storage, exports to a file, and round-trips through a URL fragment for free. No
editor state leaks into it.

### Targets are data, not code

Each host is a record of capability flags: tables, nested list depth, raw HTML,
image sizing, table of contents, size limits, anchor link syntax. Adding a host
is a new record plus a golden-file test. The engine never changes.

### Degradation is the product

Every capability has a declared fallback. No tables becomes an aligned
definition list. No image sizing becomes the raw embed plus a diagnostic.
Nesting deeper than the host allows is flattened with a visible indent
convention. The artist learns this in the editor, not after pasting.

### Diagnostics

Severity, originating block id, a stable code, a human sentence, and the
fallback applied.

### Determinism

No clock, no randomness, no ambient state. The same document and target always
yield byte-identical Markdown. This is what makes golden-file testing possible
and the correctness claim checkable rather than asserted.

### The narrow gate

User text is normalized and escaped before it reaches an emitter. Raw HTML is
emitted only when the target allows it and the user has explicitly opted in. The
preview renders user-authored Markdown in our own origin, so it is a genuine XSS
surface and receives a sanitizer, not trust.

### Repository shape

```
/engine   pure TS, zero runtime deps
  targets/    one data record per host
  emit/       block emitters
  lint/       capability checks to diagnostics
  tests/golden/<target>/<fixture>.md
/app      the PWA, imports engine
/proxy    one serverless function: image upload
```

## 5. The app

Three surfaces over one document: Build, Preview, Export. On a phone they are a
bottom tab bar. On desktop the same three collapse into a split pane. Same
components, no second UI to maintain.

A page is a vertical list of blocks. A plus button opens a sheet of block types.
Tapping a block opens a focused form, full screen on mobile and an expanded card
on desktop. Reordering offers both drag handles and up and down buttons, because
drag on a phone is unreliable and the audience is on phones.

### Block library, v1

| Block | Fields |
|---|---|
| `profile` | avatar, display name, tagline, status (open, closed, waitlist), links, payment methods |
| `menu` | tiers (name, price, currency, blurb, what is included, optional sample image) plus a shared add-ons list |
| `gallery` | items (image, caption, optional link) and a layout hint of grid, list, or single |
| `prose` | heading plus deliberately narrow rich text: bold, italic, lists, links, nothing else |
| `heading`, `divider` | connective tissue |

### Target switching

Target is a page-level setting that can be flipped at any time. Switching
recompiles and re-lints immediately. That flip is the demo moment: the same
page, a different host, visibly different warnings.

### The preview renders the emitted Markdown

Not the block model. Rendering our own internal model would show the artist a
picture no host will produce, which makes the entire value proposition a lie. So
the preview parses the compiled output through a renderer configured by the same
capability matrix, and sanitizes it.

Honest limit: the preview approximates each host's renderer and cannot be
byte-perfect without running their code. Mitigation is golden fixtures checked
against the live sites during development, plus a one-tap handoff so the artist
confirms on the real thing. The caveat ships visibly rather than being hidden.

### Persistence

Local first. Documents are small JSON in IndexedDB, several pages per user, with
export and import to a file. No accounts in v1.

### The upload path

The only place we touch a server.

The client picks a file, validates type and size, downscales and re-encodes
through a canvas to cap the payload, then POSTs to our proxy. The proxy
re-validates everything, sniffs the actual MIME from magic bytes rather than
trusting the declared header, enforces a byte ceiling and a per-IP rate limit,
and only then forwards to the image host using a key that never leaves the
server. If the proxy is unavailable the UI degrades to URL paste mode with an
honest message rather than a broken button.

### Handoff and accessibility

Copy Markdown is the primary action, with a download and a short host-specific
walkthrough alongside. Accessibility is a requirement, not polish: real touch
targets, labelled inputs, sane focus order. The users are non-technical people
on phones, exactly the population a keyboard-only UI fails.

## 6. Error handling

The engine never throws. `compile()` always returns diagnostics, because a
builder that crashes on a half-finished page is useless to someone assembling
one on a bus. Malformed input is caught by a schema validator at the boundary
and reported, not swallowed.

The `Document` carries a `schemaVersion` with forward migrations. Opening a
document newer than the app understands refuses politely instead of silently
corrupting it. Losing an artist's page is the one failure they will not forgive.

Failures are named, never generalized. Upload distinguishes offline, rate
limited, rejected by host, and too large, each with its own message and next
step. Storage quota exhaustion says so and offers an export. Broken image URLs
are caught on load error and flagged in the preview, since a dead hotlink is the
most common way these pages rot.

Offline, the service worker serves the app shell and editing works normally.
Only upload requires the network, and it says so.

## 7. Testing

Golden files are the backbone: one fixture set compiled per target, byte
compared. They make "this renders correctly on that host" checkable rather than
a marketing line.

On top of that:

- A determinism property test: identical input yields identical bytes.
- A lossless round-trip test for `Document` to JSON and back.
- A sanitizer test driving an XSS corpus through every user-authored field,
  asserting nothing executable reaches the preview DOM.
- Proxy tests for oversize payloads, forged magic bytes, rate limiting, and a
  missing key.
- A parity test on the `Document` schema asserting field names, types, and
  order.

One thing that cannot be automated: pasting fixtures into the real hosts and
comparing. That is a documented manual checklist, run whenever a target record
changes.

## 8. Deployment

Engine as a versioned package. App static, alongside the existing portfolio.
Proxy as a single serverless function holding the key in an environment
variable. CI runs build, tests, lint, a11y, and a secret scan.

## 9. Constitution invariants

Written as testable MUST rules with thresholds.

1. The engine MUST be pure: no DOM, no network, no clock, no randomness.
2. `compile()` MUST be deterministic: identical document and target yield
   byte-identical output.
3. `compile()` MUST NOT throw on any schema-valid input. Problems surface as
   diagnostics.
4. Adding a host MUST NOT change engine code, only a target record plus
   fixtures.
5. No secret MUST ever appear in the client bundle, enforced by a CI scan.
6. All user-authored content MUST pass the sanitizer before entering the preview
   DOM.
7. The `Document` schema MUST be version-stamped and guarded by a parity test.
8. Every interactive control MUST meet a 44px touch target and pass automated
   a11y checks.
9. The app MUST remain fully functional with the upload proxy unavailable.

## 10. Out of scope for v1

Accounts and cloud sync, direct publish via host APIs, custom CSS on the output,
collaboration, a templates marketplace, internationalization, plain-text bin
support, and any host beyond the verified two or three.

Direct publish is the natural phase two and the clean upgrade path.

## 11. Known open item

The capability matrix is designed as structure, not values. What each host
actually supports must be verified against the live renderers rather than filled
in from memory. That verification is task one, and its output is the matrix data
plus the golden fixtures.
