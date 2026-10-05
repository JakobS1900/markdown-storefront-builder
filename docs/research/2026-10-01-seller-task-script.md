# Seller task script for the menu workflow prototype

Use this with at least five people who make or maintain a shop menu. Give each
person both the current app and the prototype. Alternate which version they
start with when the test setup permits it. Use fictional products only. Ask them to think aloud, but do not
teach the controls while a task is underway. Record any help you give.

## Before the session

Give the seller the two app links or builds, labeled A and B, without saying
which is newer. Make sure each starts with a blank page. Use a timer. Record
which version was first, the device, and whether the seller normally makes or
imports menus.

The current Android baseline is `v0.12.1`. The local signed prototype build is
`0.13.0-test.1` at `android/app/build/outputs/apk/release/app-release.apk` in
the feature checkout. Both use the same Android app ID. On one test device,
complete baseline tasks first, then install the prototype as an update with
`adb install -r`. Do not uninstall an existing app to switch versions, because
uninstalling removes saved pages. To alternate version order, use separate test
devices or independent browser sessions. Record which setup was used. The
prototype was checked on an Android 6.0.1 tablet after its WebView update. It is
still a draft build, not a public release.

## Task 1: make a menu

Read this aloud: "You sell handmade goods. Make a menu with a Ceramics group:
Hand-thrown mug for $28, Speckled planter from $35, and Custom name plaque with
the price Ask me. Add a Prints group with Botanical print for $18. Show me what
a buyer would see, then find the text you would copy to publish it."

Start the timer when the seller can touch the app. Stop when they have shown
the buyer view and copy text, or after 10 minutes. Let them choose their own
path. Note where they hesitate, backtrack, or ask for help. Check the exact
group and item order and all four price strings.

## Task 2: bring in an existing menu

Give them this text to paste. Read this aloud: "Bring this menu into the app.
Before saving, check which values are item names, sizes, and selling prices.
Then show me the buyer view and the text you would copy."

```markdown
# Ceramics

| Product | Size | Price |
| --- | --- | ---: |
| Speckled mug | 12 oz | $28 |
| Blue mug | 16 oz | $32 |
```

Stop the timer when they have shown both results, or after 10 minutes. Check
that both names, both sizes, and both selling prices survive. Also ask them to
point to anything they were unsure about before pressing Add.

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
without help. This task checks the usability iteration, not the broader feature
030 correction panel.

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

Do not treat a completed task alone as proof that the app is easier. Compare
time, help, corrections, missing values, and the seller's explanation across
versions. Keep the raw observations alongside any summary decision.
