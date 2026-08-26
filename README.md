# Storefront Builder

Artists sell commissions from pages they host on Markdown paste sites like
rentry.co. They do not know Markdown, so they learn table syntax or pay someone
who has. This turns that into a compiler problem.

A block document goes in. Host-correct Markdown comes out, along with a warning
for every compromise made on the way.

**Try it:** [jakobs1900.github.io/markdown-storefront-builder](https://jakobs1900.github.io/markdown-storefront-builder/)
Works on a phone, installs to a home screen, and runs with no network. Nothing
is sent anywhere: storage, compilation, and preview are all local.

**Case study:** [jakobs1900.github.io/portfolio/storefront-builder.html](https://jakobs1900.github.io/portfolio/storefront-builder.html)

## Running it

```powershell
npm install     # from PowerShell, not Git Bash. See CLAUDE.md for why
npm run dev     # the app
npm run verify  # typecheck, lint, 529 tests, secret scan, dash scan, accessibility
```

## What is where

| Path | What it is |
|---|---|
| `engine/src/document/` | The contract. A versioned page format, its validator, and a canonical writer. Pure, zero dependencies. |
| `engine/src/compile/` | The compiler. Hosts described as data, one emitter per section type, and a lint pass that reports every compromise. |
| `engine/tests/compile/golden/` | Expected output, byte compared. Readable Markdown, so a human can judge a diff. |
| `app/` | The editor. Mobile first, local only, no account, no framework. |
| `specs/` | Every specification, architecture review, and holistic review, committed beside the code they describe. |

## The parts worth reading

**`engine/src/document/descriptor.ts`** is the schema, and it is data. The
validator walks it, the writer emits keys in its order, and a parity test
snapshots it, so a change to any field name, type, or order fails the build.
The TypeScript types are derived from it rather than maintained alongside it,
because two hand-written artifacts that must agree eventually will not.

**`engine/src/compile/targets.ts`** is every supported host, described entirely
as capability values with a cited source for each. No emitter branches on which
host it is compiling for. A test proves that by inventing a host inside the test
and compiling against it, which only works if the claim is true.

**`engine/src/compile/escape.ts`** is the one that would keep me up. Artist text
lands on a page hosted on someone else's domain, whose renderer I cannot
inspect, so `<`, `>`, and `&` become HTML entities rather than backslash
escapes. The character is absent from the output entirely, and no renderer can
build a tag out of what is not there.

**`engine/tests/compile/golden/portable/hostile-page.md`** is the security
argument as something you can read in thirty seconds: a script tag entity
encoded, a `javascript:` link rendered inert as plain text, a `data:` image
dropped, pipes escaped with the table still rectangular.

**`specs/*/holistic-review.md`** are the reviews, including the findings that
make me look slow. The most valuable defect in the project was found by opening
the app and clicking the first button, and it is written up as such.

## What is enforced rather than intended

- **Engine purity** is an ESLint rule. `engine/src/**` cannot reference
  `document`, `window`, `fetch`, `Date.now`, or `Math.random`.
- **Schema drift** fails a parity test on every field name, type, and order.
- **Output correctness** is byte compared against checked-in Markdown.
- **Accessibility** runs axe-core over the rendered interface, plus assertions a
  machine cannot make: every control has a real name, no placeholder stands in
  for a label, the touch target minimum is in the stylesheet.
- **No secrets** and **no em or en dashes** each have their own scanner.

Each gate was verified by making it fail on purpose, not by assuming it works.

## Known limitations, stated rather than buried

**The two hosts barely differ, though they no longer agree entirely.** They
diverge on exactly one thing: the hard line break, where rentry needs two
trailing spaces and the portable baseline uses the CommonMark backslash. That
divergence exists because live verification found the backslash form silently
broken on rentry, not because it was designed in. Everything else in the current
section types renders the same on both, so the compatibility machinery is still
mostly proved by synthetic hosts in the tests.

**The published build has no image uploading, on purpose.** There is no upload
button. The image field takes a web address, and tells an artist to upload at
imgur.com, which needs no account, and paste the address it gives back. That is
the flow people already use, and it is verified on a phone.

The alternative was one Imgur Client-ID baked into the bundle and shared by
every artist. It is a better experience, and it was rejected for a specific
reason rather than a vague one. A Client-ID identifies the application, not a
user, so anonymous uploads made with it belong to no account and never appear
in the owner's gallery. But the registration is the owner's, and so is the
responsibility: one artist uploading something against Imgur's rules gets the
**application** banned, and uploads then break for every user at once, with no
warning. The daily quota is shared the same way.

The obvious fix, asking each artist to register their own, is worse than the
problem. Registering an API application is harder than learning the Markdown
this whole project exists to remove, so that path fails Principle VI before it
starts.

The upload code is still there and still tested, for anyone building their own
copy. Set `VITE_IMGUR_CLIENT_ID` and the button appears. See `.env.example`.
Be aware of what you are taking on: the key is a public identifier that ships
in the bundle, anyone can copy it out and spend your quota, and the answer to
that is to register a new one and rebuild.

One trap worth knowing if you do. An invalid or revoked Client-ID makes
`POST /3/image` answer 429 "Too Many Requests", which is indistinguishable from
a real rate limit, while `GET /3/credits` answers 403 "Invalid client_id". A
dead key looks exactly like a busy afternoon.

## Licence

Not yet chosen.
