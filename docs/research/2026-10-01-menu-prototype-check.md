# Menu workflow prototype check, 2026-10-01

The prototype implements the experiment in the [seller workflow audit](2026-10-01-seller-workflow-audit.md). This is technical verification, not evidence that sellers find it easier. The [seller task script](2026-10-01-seller-task-script.md) is ready for five comparative sessions.

## What changed

- A blank page offers Create a menu. Category, item name, and price are visible in the direct editor; a second category can be added beside the current one. Existing detail and ordering controls remain available.
- Converting ambiguous public page text to Prices is blocked when it could hide a selling price or other public value. The source remains editable as Text.
- A consistent Markdown pipe table can be reviewed as Product, Price, and optional Size columns before saving. The review shows source cells and resulting rows, supports role changes, keeps extra cells public, and provides Keep as Text.
- A row with a blank Price and nonempty Size remains Text rather than compiling the Size as a selling price.

## Checks performed

`npm run verify` passed with exit 0 in PowerShell: 89 test files, 1,739 tests, 63 accessibility tests, clean light and dark contrast, menu file checks, and the PWA update gate. The holistic review finding about blank Price plus Size was fixed and covered by a buyer-output regression test before this run.

An isolated Chrome probe at 320 and 390 CSS pixels checked the review and Build, Preview, and Copy results. Both reviewed table rows were reachable by normal page scrolling; there was no horizontal document overflow. Product, Size, and Price used source columns 1, 2, and 3. After confirming, the buyer view and copied menu contained `Ceramics`, `Speckled mug`, `Blue mug`, `12 oz`, `16 oz`, `$28`, and `$32`. The [320px review](media/2026-10-01-mapping-320.png) and [390px review](media/2026-10-01-mapping-390.png) screenshots show the mapping surface. Focused tests also covered a four-item, two-category direct menu through Build, Preview, and Copy.

The [390px direct editor screenshot](media/2026-10-01-direct-menu-390.png) shows a three-item Ceramics category entered without the wizard. It shows a remaining concern for the sessions: repeated item cards still make the editor tall on a phone, even with Category, Item, and Price exposed.

## Desktop review after the tester build

A fresh review of the whole feature diff against `origin/master` found no new
correctness, data-loss, accessibility, or integration issue. A separate spec and
quality review of the compact menu refinement found two issues before this
record was updated. The first draft hid concrete Item and Price examples from
later rows, contrary to feature 027's field guidance requirement. The second
draft constrained three item controls to the narrow Price column. Both were
fixed and the reviewers confirmed closure.

The menu form now puts Item and Price in two columns, keeps examples on every
row, and places reorder and remove controls across the full row. A named
category shows its name and item count visually while its button retains an
explicit Open or Close accessible name. Unnamed sections keep their visible
type and action. The [320px editor](media/2026-10-01-compact-menu-320.png)
and [390px editor](media/2026-10-01-compact-menu-390.png) show the revised layout.

An isolated Chrome run created the four-item Ceramics and Prints menu, checked
both categories and all four price strings in Preview and Copy, then imported
the two-row Product, Size, Price example from the Copy tab. It reviewed the
three roles as source columns 1, 2, and 3, confirmed the page, and found both
names, `$28`, `$32`, `12 oz`, and `16 oz` in Preview and Copy. At 320 CSS pixels,
the three-item editor had no horizontal document overflow and every reorder or
remove button stayed within its item card. The browser reported no page
exceptions. The editor is still vertically long, so the real seller sessions
must judge whether this is enough of an improvement.

A final code review caught whitespace-only Category values appearing as a
blank-looking compact section label. The section now keeps its visible Prices
type in that case, and a regression test covers it. The reviewer confirmed
closure.

The existing quantity fixture still produces two categories, five product names, and 16 amount-price pairs in integration tests. This check did not use a private source menu.

## Local Android test build

`npm run android:sync` completed from the final code and Gradle
`assembleRelease` reported `BUILD SUCCESSFUL in 27s`. The local signed APK is
`android/app/build/outputs/apk/release/app-release.apk`, versionCode 19 and
versionName `0.13.0-test.1`, 3,240,240 bytes. Its SHA-256 is
`A980F4906824F45D68A9CAE59DB629E9EFDEE9789EAD8A7F847996D8238469DD`.
`apksigner` verified v2 and v3 signatures and the expected certificate digest
`c952b39cfd7b335efe5269fb25b8a17e4c6aaeb757aa1d1e5453e45b123018e0`.
The `index-Fz2x6ES5.js` asset inside the APK and the built web asset had the
same SHA-256, `21B398DA414FD54F3AB1D784D04BCE1C78F4ED6ADC319219F05089BE0FA1B464`.
Jakob then connected tablet `3404d221b89fc1f1`, an SM_T700 with Android
6.0.1, API 23. The app's minimum is API 24, so the APK cannot install there.
Chrome 101 is present, but automatic approval review rejected the ADB command
to open the local site. The temporary port reverse was removed. There is no
on-tablet interaction result. This build remains local and is not a feature
release.

## Decision still pending

Five real sellers need to attempt both menu creation and table import on the current release and prototype. Record completion, elapsed time, help, backtracks, and missing or wrong values with the task script. Review those observations before claiming the workflow is easier or publishing feature 032 as a normal release. No seller sessions or handset check have been completed for this prototype.
