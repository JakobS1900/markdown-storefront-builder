# Android 6 compact Build and file listing check, 2026-10-02

## Observed friction and change

On the SM_T700, an existing one-section page placed the full optional private title field above the page paste action. After opening paste, the same start button remained above the active panel, even though pressing it again did nothing. This pushed the source field farther down and made the active task less clear.

The nonempty Build screen now folds the private title as the blank screen already did. A saved title appears in the disclosure label, so its value stays visible. The paste start appears only when it can open a panel. The blank screen also removes its start choices while a paste panel is open. The page title, sections, import logic, and saved document format are unchanged.

The focused first-sight test failed on the old layout, then passed with 13 of 13 tests. Full `npm run verify` exited 0 on 2026-10-02: 90 test files and 1,889 tests, 65 accessibility tests, clean secret and dash scans, zero light and dark contrast failures, and passing menu-file and PWA update gates. `git diff --check` exited 0.

## Tablet result

`npm run android:sync` exited 0. The JDK 21 signed release build reported `BUILD SUCCESSFUL in 1m 50s`. The resulting APK is `0.13.0-test.4`, versionCode 22, minSdk 23, SHA-256 `D4FDFDBD472C0F007FC669850C4F04CAEBCCE1F06088C7EB33AE88F94048A937`. `apksigner verify` exited 0 with v1, v2, and v3 true and certificate SHA-256 `c952b39cfd7b335efe5269fb25b8a17e4c6aaeb757aa1d1e5453e45b123018e0`, the same certificate used by the previous installed build. `adb install -r` returned `Success`; package metadata reported versionCode 22 and versionName `0.13.0-test.4`.

On cold launch, the saved `Open Prices: 1 item` section remained. [Compact Build](media/2026-10-02-android6-compact-build.png) shows the private title folded above the one paste action and saved section. [Active paste](media/2026-10-02-android6-compact-paste.png) shows the source field without a repeated start button. Tapping Done pasting restored the start action and left the saved section in place. The tablet was awake before each capture. USB stay-awake was restored to `mStayOn=false` and setting `0` after the check.

## File picker limit

The fictional `mdsb-tablet-menu.md` and `.txt` files were present in `/sdcard/Download`. Android's media scanner broadcast completed, and `content://media/external/file` then listed both files, with the `.txt` reported as `text/plain`. Android 6 DocumentsUI still showed [No items in Downloads](media/2026-10-02-android6-downloads-empty.png). This is a provider listing limit of this test setup, not proof that the app cannot read a selectable Markdown file. The complete `.md` selection and read remains unverified on this tablet. No saved app page was deleted or replaced.

The app still uses Capacitor 7. Its Android runtime requires WebView Chrome 60 or newer. This tablet runs WebView 106; this check does not establish support for its former WebView 49.
