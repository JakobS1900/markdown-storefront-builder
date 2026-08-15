# Holistic Review: The Remaining Block Emitters

**Feature**: 003-block-emitters
**Date**: 2026-08-15
**Scope**: All four emitters read together.

Same conduct note as before: gstack unreachable, zen down, no subagent per
Jakob's standing instruction. Performed directly.

Six candidate findings written as tests before being believed. Five passed on
the first run and were wrong suspicions, kept as regression cover. One failed.
Two further defects surfaced during implementation, before this stage, and are
recorded here because both are the kind that survives a per-emitter review.

## HB-6. An unsafe avatar was dropped in silence (MEDIUM)

Four places take an address from the artist: a profile link, a profile avatar, a
gallery image, and a gallery item's link. Three of them refuse an unsafe address
and warn. The avatar refused it and said nothing.

SC-004 allows zero silent degradations. An artist whose profile picture simply
vanishes has no way to work out why, and would reasonably conclude the tool is
broken rather than that their address was refused.

Each emitter reviewed alone looks right. The gallery reviewer sees two refusals
that both warn. The profile reviewer sees links that warn. Only lining all four
up shows one is missing, which is precisely what this stage is for.

**Fixed**: the avatar refusal now warns like the other three.

## Found during implementation, recorded because they generalise

### The currency was prefixed onto prices that are not numbers (MEDIUM)

`withCurrency` prefixed the currency to any price not already containing it, so
a tier priced "DM me" rendered as **"USD DM me"**.

The contract stores prices as text precisely because artists write "45", "from
45", "45+", and "DM me". The emitter then treated all of them as numbers.

Worse than merely wrong: it reads as a mistake the artist made, on the page they
are using to get paid.

**Fixed**: the currency is added only to a price that is purely digits and
separators. Anything containing a letter is left exactly as written, on the
assumption that the artist had a reason.

Caught by reading the generated golden file rather than by a test. That is what
golden files are for, and it is an argument for keeping them readable.

### The golden generator read stale build output (MEDIUM, tooling)

`write-golden.mjs` reads the compiled engine from `dist`, while the golden test
reads the source through Vitest. After fixing the currency bug, the generated
files still contained the old output, because the build had not been rerun.

The tests would have caught the disagreement, so this could not have shipped.
But it wastes a cycle and, worse, invites someone to regenerate goldens that do
not match the code and then spend an hour wondering why.

**Fixed**: `npm run golden` now builds first.

## Wrong suspicions, kept as regression cover

- **HB-1**: section headings at inconsistent levels. All four use the shared
  constant, and the test fails if one stops.
- **HB-2**: two sections adjacent with no blank line, or a doubled blank line.
  Neither occurs. The first would turn a line into a heading on some renderers.
- **HB-3**: a table header emitted with no rows, or a table that is not
  rectangular. Neither occurs, including the padded final row of a grid.
- **HB-4**: artist text escaping its section on a page containing every kind.
  It cannot, including text that is exactly `***`.
- **HB-5**: determinism, non-mutation, and diagnostic accumulation across the
  four new emitters. All hold.

## An honest note about the two shipped hosts

`rentry` and `portable` produce identical output for every fixture in this
feature. Both support six heading levels and both support tables, so nothing in
the current block set distinguishes them.

That is not a failure of the design, and it is worth stating plainly rather than
manufacturing a difference to make the compiler look busier. The mechanism is
proved by the synthetic hosts in the tests: a host with two heading levels
clamps and warns, a host without tables degrades the menu to a list and warns,
and a host invented inside a test compiles correctly without the registry
knowing it exists.

rentry's genuinely non-standard features, image sizing and the `[TOC]` family,
have nothing in the contract to consume them. Image sizing needs dimensions the
contract does not carry, and a table of contents is a page-level option nothing
requests. Adding either means changing the contract, which is a decision with its
own cycle, not something to smuggle in to make a demo more impressive.

## Outcome

One finding at this stage, two during implementation, all fixed. The most
valuable was found by reading a generated file rather than by any test, which is
the argument for golden files being readable Markdown rather than escaped
strings in an assertion.
