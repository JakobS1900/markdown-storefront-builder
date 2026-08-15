# Workflow

The pipeline this project runs, with domain substitutes recorded for the steps
that do not apply here or are unavailable in this environment.

Source: Jakob's battle-tested SpecKit plus gstack plus Superpowers pipeline,
validated across six shipped features on the Tessera Android project.

## Per-feature cycle

| Step | Command or trigger | Status here |
|---|---|---|
| 1 | `/speckit-specify <description>` | Available |
| 2 | Resolve genuine ambiguities in ONE batched question | Available |
| 3 | `/speckit-plan` | Available |
| 4 | `/plan-eng-review` | **UNAVAILABLE**, see substitute below |
| 5 | `/speckit-tasks` | Available |
| 6 | `/speckit-analyze` | Available |
| 7 | Chunked implementation via Superpowers subagent-driven-development | Available |
| 8 | Holistic review over the whole feature diff | Substitute below |
| 9 | `/review` | **UNAVAILABLE**, substitute below |
| 10 | `/cso` for permissions, file I/O, network, or auth | **UNAVAILABLE**, substitute below |
| 11 | Verification on the real target | Available, see below |
| 12 | Commit, version, changelog, ship | Manual, local only |

## Substitutes for the unavailable gstack gates

The gstack skills are installed at `C:/Users/Emu/.claude/skills/` but are not
reachable from sessions whose config dir is `.claude-personal/`. Their absence is
an accepted gap, not evidence that review is unnecessary. Until they are
reinstated:

- **Architecture review (step 4).** Substitute `mcp__zen__thinkdeep` or
  `mcp__zen__analyze` with `model: flash` against the plan artifacts, plus a
  fresh `Plan` or `general-purpose` subagent instructed to attack the plan rather
  than approve it. This gate caught a real bug in every feature Jakob has
  shipped, so it is run every cycle regardless of which tool implements it.
- **Holistic review (step 8).** A fresh subagent over the whole feature diff,
  given the spec and told to look specifically for cross-cutting failures that a
  per-chunk reviewer could not see, because each chunk reviewer only ever saw one
  internally correct side of a seam.
- **Diff review (step 9).** `mcp__zen__codereview` with `model: flash`, plus the
  `agent-skills:code-reviewer` persona.
- **Security review (step 10).** `mcp__zen__secaudit` with `model: flash`, plus
  the `agent-skills:security-auditor` persona. Mandatory for the upload proxy
  and the sanitizer.

Reinstating the real gates does not require a constitution amendment. Prefer them
whenever they are reachable.

## Domain substitute for browser QA

This project is a web app, so browser QA does apply. The `gstack` browser skill
IS available in this environment and covers responsive layout, forms, uploads,
and dialogs.

One thing browser automation cannot cover: whether the emitted Markdown renders
correctly on a third-party host we do not control. That is the manual
verification checklist below.

## Manual host verification checklist

Run whenever a target record changes, an emitter changes output, or a golden
fixture is added.

1. Compile every golden fixture for the target under test.
2. Paste each into a scratch page on the live host.
3. Compare the rendered result against the fixture's expected description.
4. Record the date, the host, and the outcome in `docs/research/`.
5. Any divergence is a defect in the target record, not in the fixture. Correct
   the record, regenerate the goldens, and note the source.

## What "done" means

The command was run, the output was read, and it is quoted. The full gate passes:
build, unit tests, golden comparisons, lint, accessibility, and the secret scan.
"Should work" is not done.
