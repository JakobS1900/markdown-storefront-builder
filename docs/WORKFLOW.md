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

## Device verification checklist

Run whenever the Android build ships something that has to be seen working. The
order matters: every step here exists because skipping it produced a wrong
answer rather than a visible failure.

1. `adb devices -l`, and check `dumpsys power` for `mWakefulness`. A dozing
   screen has hung four runs and, on 2026-09-01, produced three identical white
   screenshots that were read as the app failing to render. It had been working
   the whole time.
2. `adb shell svc power stayon usb` for the length of the run, and
   `svc power stayon false` afterwards. It is the owner's device setting.
3. Build with `$env:JAVA_HOME="C:\Program Files\Java\jdk-21"`. The machine's
   global `JAVA_HOME` is JDK 8 and Gradle refuses it; JDK 17 fails differently.
4. Bump `versionCode` before building, and install with `-r` and the same
   signing key. **Never uninstall to install.** That erases the owner's saved
   pages, which is the one thing this project must not do.
5. `MSYS_NO_PATHCONV=1` for `adb shell` as well as `adb pull`, or `screencap`
   prints its usage text instead of capturing.
6. Re-check wakefulness IMMEDIATELY BEFORE each capture, not once per run. A
   capture under roughly 20 kB is a sleeping screen until proven otherwise.
7. A release build is not inspectable, which is correct. When a defect needs
   real evidence rather than a screenshot, rebuild with
   `webContentsDebuggingEnabled` in `capacitor.config.json`, signed with the
   SAME key so the update installs over the top and the owner's pages survive.
   Remove it, rebuild, reinstall, and confirm no debug socket answers before
   walking away.
8. Anything typed into one of the owner's pages during a check is removed
   afterwards, addressed by the control's own accessible name and never by its
   position. Position has destroyed the owner's work here once already.

## What "done" means

The command was run, the output was read, and it is quoted. The full gate passes:
build, unit tests, golden comparisons, lint, accessibility, and the secret scan.
"Should work" is not done.
