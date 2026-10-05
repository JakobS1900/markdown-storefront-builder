# Seller task script for the menu workflow and import correction

Use this with at least five people who make or maintain a shop menu. Give each
person both the current app and the prototype. Alternate which version they
start with when the test setup permits it. Use fictional products only. Ask them to think aloud, but do not
teach the controls while a task is underway. Record any help you give.

## Before the session

Give the seller the two app links or builds, labeled A and B, without saying
which is newer. Make sure each starts with a blank page. Use a timer. Record
which version was first, the device, and whether the seller normally makes or
imports menus.

The Android baseline is `v0.12.1`. Use the latest verified combined draft build
from features 032, 030 and 033 as version B, and record its exact commit and APK
version before each session. Both builds use the same Android app ID. On one test
device, complete baseline tasks first, then install the draft as an update with
`adb install -r`. Do not uninstall an existing app to switch versions, because
uninstalling removes saved pages. To alternate version order, use separate test
devices or independent browser sessions. Record which setup was used. The draft
is a test build, not a public release.

As of 2026-10-05, version B is `0.13.0-test.7`, versionCode 25, from commit
`d02278d`. It is installed on the SM_T700 and has passed native import, picture
selection, preview, export and cold-launch persistence checks. See the
[device evidence](2026-10-05-native-picture-picker.md).

This tablet already has the prototype. Do not downgrade, uninstall or clear its
data to recreate the baseline. Use a separate baseline device or an isolated
browser session for version A. If only the prototype is available, record the
session as prototype-only; it provides observations but not a baseline comparison.
Use Start a new page for the session and retain existing saved pages.

## Task 1: make a menu

Read this aloud: "You sell handmade goods. Make a menu with a Ceramics group:
Hand-thrown mug for $28, Speckled planter from $35, and Custom name plaque with
the price Ask me. Add a Prints group with Botanical print for $18. Show me what
a buyer would see, then find the text you would copy to publish it."

Start the timer when the seller can touch the app. Stop when they have shown
the buyer view and copy text, or after 10 minutes. Let them choose their own
path. Note where they hesitate, backtrack, or ask for help. Check the exact
group and item order and all four price strings.

## Task 2: bring in and correct an existing menu

Give them this text to paste. Read this aloud: "Bring this menu into the app.
Change the Blue mug to Blue bowl and its selling price to from $35. Check the
names, sizes, prices, and note before saving. Then show me the buyer view and
the text you would copy."

```markdown
# Ceramics

| Size | Price | Item | Notes |
| --- | ---: | --- | --- |
| 12 oz | $28 | Speckled mug | Handmade |
| 16 oz | $32 | Blue mug | Blue glaze |
```

Stop the timer when they have shown both results, or after 10 minutes. Check
that Speckled mug, 12 oz, $28 and Handmade survive; that Blue bowl, 16 oz,
from $35 and Blue glaze stay associated; and that no header becomes an item.
Ask them to point to anything they were unsure about before pressing Add. If
the app cannot make the correction before Add, let them try another path and
record where they expected to find it.

After they correct the row but before Add, ask them to try changing a column
assignment without losing the correction. Record whether they find the warning,
cancel or undo choice, and whether they trust the final result. If they have
already pressed Add, skip this probe and record that. Do not coach them through
the recovery path.

## Task 3: correct a short price list

Give them this fictional list. Read this aloud: "Add these items to a menu. Before
you add them, change the second item to Hand-dyed silk scarf at from $40. Show me
what a buyer would see."

```text
Woven basket, $24
Hand-dyed scarf: from $35
Cotton tote | $18
```

Stop after the buyer view or 10 minutes. Check that the other two names and prices
remain as pasted, the corrected second row is exact, and the original lines were
visible during review. Note whether they found the row correction controls
without help. This task checks whether the row correction is discoverable on
an ordinary price list as well as on a table.

## Task 4: a name above a price table

Give them this fictional page. Read this aloud: "Bring this in as a menu. Make
Figures contain Arrow Orb in 12 oz at $25 and 16 oz at $32. Show me the buyer
view and the text you would copy. Figures and Arrow Orb should each appear once."

```markdown
# Figures

Arrow Orb

| Item | Amount | Price |
| --- | --- | --- |
| | 12 oz | $25 |
| | 16 oz | $32 |
```

Stop after both results or 8 minutes. Record whether the seller discovers a
direct way to use the nearby name and heading, removes duplicate source sections
by hand, publishes duplicates, or gives up. Check both amount and price pairs.
Record whether they choose `Adjust as prices` on the standalone name before
finding the table's `Review section` control, and what they expected each to do.
Ask what they thought would happen to the original name and heading before Add.
Do not show them the source-use control during the task.

## After each app version

Ask: "Which step felt slow or confusing? What did you expect that control to
do? Did you worry anything would be lost or published incorrectly?" Record
their words without explaining the design first.

## Observation sheet, one row per person and app version

| Seller ID | Version | Order | Device | Task | Completed without help? | Time | Backtracks or corrections | Help given | Wrong or missing values | Exact confusing moment |
|---|---|---|---|---|---|---|---|---|---|---|
| | | | | 1 | | | | | | |
| | | | | 2 | | | | | | |
| | | | | 3 | | | | | | |
| | | | | 4 | | | | | | |

Do not treat a completed task alone as proof that the app is easier. Compare
time, help, corrections, missing values, and the seller's explanation across
versions. Keep the raw observations alongside any summary decision.
