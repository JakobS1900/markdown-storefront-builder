# Android 6 Copy paste action check, 2026-10-02

## Friction and fix

The Copy screen left its "Paste a page you already have" start button visible while the paste panel was open. Pressing the start button again had no effect. The repeated control made the active task look unclear. The start button now appears only when the panel is closed, for both an empty page and a page with content. Copy, file export, backup, and the saved document are unchanged.

Two focused assertions failed before the fix and passed afterward. Full `npm run verify` exited 0: 90 test files and 1,890 tests, 65 accessibility tests, clean secret and dash scans, zero light and dark contrast failures, and passing menu-file and PWA update gates. `git diff --check` exited 0.

## Tablet result

`npm run android:sync` exited 0, and the JDK 21 signed release build reported `BUILD SUCCESSFUL in 40s`. The APK is `0.13.0-test.5`, versionCode 23, minSdk 23, SHA-256 `1540FCD3387F3E90DDEF768EE9876AD15FD798CC4FF9DBA752AA587BE40789C7`. `apksigner verify` exited 0 with v1, v2, and v3 true and certificate SHA-256 `c952b39cfd7b335efe5269fb25b8a17e4c6aaeb757aa1d1e5453e45b123018e0`. `adb install -r` returned `Success`; package metadata reported versionCode 23 and versionName `0.13.0-test.5`.

On cold launch, the saved `Open Prices: 1 item` section remained. [Copy before opening paste](media/2026-10-02-android6-copy-before.png) shows the saved `Blue bowl | 35` output and one paste start button. [Copy with paste open](media/2026-10-02-android6-copy-open.png) shows the source field and Done pasting action without that duplicate start. [Copy after Done](media/2026-10-02-android6-copy-done.png) shows the start action returned and the output remained. The tablet was awake before each capture. USB stay-awake was restored to `mStayOn=false` and setting `0` after the check.

This verifies the populated Copy state on the SM_T700 running Android 6.0.1 with WebView 106. The empty state is covered by the focused UI test. The test does not establish support for the tablet's former WebView 49; Capacitor 7 requires WebView 60 or newer. Five real seller task sessions remain pending for the combined prototype.
