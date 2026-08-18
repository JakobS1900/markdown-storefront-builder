# Storefront Builder

Artists sell commissions from pages they host on Markdown paste sites like
rentry.co. They do not know Markdown, so they learn table syntax or pay someone
who has. This turns that into a compiler problem.

A block document goes in. Host-correct Markdown comes out, along with a warning
for every compromise made on the way.

**Case study:** [jakobs1900.github.io/portfolio/storefront-builder.html](https://jakobs1900.github.io/portfolio/storefront-builder.html)

## Running it

```powershell
npm install     # from PowerShell, not Git Bash. See CLAUDE.md for why
npm run dev     # the app
npm run verify  # typecheck, lint, 490 tests, secret scan, dash scan, accessibility
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

**The image host hop has never run.** `proxy/src/worker.ts` is written from
catbox.moe's documented API and has not been executed against it. Everything
else in the proxy is tested, and the client upload path was verified end to end
against a local instance. See `proxy/README.md`.

**Inline formatting in prose is not supported.** Bold, italic, and lists inside
a text section need either a parser with a whitelist or a change to the contract,
and both deserve their own cycle rather than being smuggled into an emitter.

## Licence

Not yet chosen.
