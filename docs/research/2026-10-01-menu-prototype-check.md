# Menu workflow prototype check, 2026-10-01

The prototype implements the experiment in the [seller workflow audit](2026-10-01-seller-workflow-audit.md). This is technical verification, not evidence that sellers find it easier. The [seller task script](2026-10-01-seller-task-script.md) is ready for five comparative sessions.

## What changed

- A blank page offers Create a menu. Category, item name, and price are visible in the direct editor; a second category can be added beside the current one. Existing detail and ordering controls remain available.
- Converting ambiguous public page text to Prices is blocked when it could hide a selling price or other public value. The source remains editable as Text.
- A consistent Markdown pipe table can be reviewed as Product, Price, and optional Size columns before saving. The review shows source cells and resulting rows, supports role changes, keeps extra cells public, and provides Keep as Text.
- A row with a blank Price and nonempty Size remains Text rather than compiling the Size as a selling price.

## Checks performed

`npm run verify` passed with exit 0 in PowerShell: 89 test files, 1,736 tests, 63 accessibility tests, clean light and dark contrast, menu file checks, and the PWA update gate. The holistic review finding about blank Price plus Size was fixed and covered by a buyer-output regression test before this run.

An isolated Chrome probe at 320 and 390 CSS pixels checked the review and Build, Preview, and Copy results. Both reviewed table rows were reachable by normal page scrolling; there was no horizontal document overflow. Product, Size, and Price used source columns 1, 2, and 3. After confirming, the buyer view and copied menu contained `Ceramics`, `Speckled mug`, `Blue mug`, `12 oz`, `16 oz`, `$28`, and `$32`. The [320px review](media/2026-10-01-mapping-320.png) and [390px review](media/2026-10-01-mapping-390.png) screenshots show the mapping surface. Focused tests also covered a four-item, two-category direct menu through Build, Preview, and Copy.

The [390px direct editor screenshot](media/2026-10-01-direct-menu-390.png) shows a three-item Ceramics category entered without the wizard. It shows a remaining concern for the sessions: repeated item cards still make the editor tall on a phone, even with Category, Item, and Price exposed.

The existing quantity fixture still produces two categories, five product names, and 16 amount-price pairs in integration tests. This check did not use a private source menu.

## Local Android test build

After the desktop restarted, `npm run android:sync` completed and Gradle
`assembleRelease` reported `BUILD SUCCESSFUL in 5m 56s`. The local signed APK is
`android/app/build/outputs/apk/release/app-release.apk`, versionCode 19 and
versionName `0.13.0-test.1`, 3,240,080 bytes. Its SHA-256 is
`DA0B49013AA3C5A24D4FE0DACEBFAF92F62A3FEFA3A682653A531D7E03506480`.
`apksigner` verified v2 and v3 signatures and the expected certificate digest
`c952b39cfd7b335efe5269fb25b8a17e4c6aaeb757aa1d1e5453e45b123018e0`.
The `index-Ct9sx3yD.js` asset inside the APK and the built web asset had the
same SHA-256, `3231BFE06F8486B996E2BDAAC34315EDBDF0524857D00A38A48C90A435D79C5B`.
There was no connected Android device for an installation or interaction check.
This build remains local and is not a feature release.

## Decision still pending

Five real sellers need to attempt both menu creation and table import on the current release and prototype. Record completion, elapsed time, help, backtracks, and missing or wrong values with the task script. Review those observations before claiming the workflow is easier or publishing feature 032 as a normal release. No seller sessions or handset check have been completed for this prototype.
