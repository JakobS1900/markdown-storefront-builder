# Android 6 compatibility check, 2026-10-01

Device: Samsung SM_T700, Android 6.0.1, API 23, `armeabi-v7a`, 1600 x 2560 display. ADB serial `3404d221b89fc1f1`.

The Capacitor 8 build required API 24. This branch now uses Capacitor 7.6.9, sets `minSdkVersion` to 23, enables v1 APK signing, and builds a legacy web bundle for the Chrome 60 WebView floor documented by Capacitor 7. The signed APK reports version `0.13.0-test.1`, code 19, API 23, v1/v2/v3 signatures, and certificate SHA-256 `c952b39cfd7b335efe5269fb25b8a17e4c6aaeb757aa1d1e5453e45b123018e0`.

The first API 23 build installed, but [the screen was blank](media/2026-10-01-api23-launch.png). Logcat showed Android using Google System WebView 49.0.2623.105, below Capacitor 7's Chrome 60 minimum. A legacy JavaScript bundle alone did not solve that runtime limit. An old WebView now gets an update message from the app shell.

The Play Store required an account sign-in. With Jakob's authorization, a standalone Google System WebView 106.0.5249.126 ARM v7 APK for API 23 was downloaded from apk.watch. Before installation, `apksigner` reported the same signing certificate SHA-256 as the tablet's installed WebView, `6faf3c4140407473400934d117815a21af1cfefc5c0bee61c858bc3d72ba6fe5`. `aapt` reported package `com.google.android.webview`, minimum API 23, maximum API 28, and native code `armeabi-v7a`. The download was 57,428,497 bytes with SHA-256 `608055587969dcabb7bc4e896c6d949f20ae7b2725a9e4192ab702a9384b9e2e`. `adb install -r` returned `Success`; `pm path` then pointed to `/data/app/com.google.android.webview-1/base.apk` and package metadata reported version 106.0.5249.126.

With WebView 106, [the app rendered](media/2026-10-01-api23-webview106.png). Taps opened the paste panel and a Prices section. The final signed APK installed with `adb install -r` returning `Success`; after force stop and relaunch, [the Prices section was still present](media/2026-10-01-api23-final.png). A device UI pass then entered `Ceramics`, `Handmade mug`, and `28`. The final APK was installed again; [Preview still showed the same values after a cold start](media/2026-10-01-api23-final-preview.png). Screenshots were captured while `dumpsys power` reported `mWakefulness=Awake`.

This proves installation, startup, basic editing, preview, and saved section persistence on this tablet with an updated WebView. It does not prove export or performance on other Android 6 devices. Five seller task sessions are still needed before calling the menu prototype usable.

`npm run verify` passed with exit 0 after the compatibility changes: 89 test files, 1,739 tests, 63 accessibility tests, clean light and dark contrast, menu file, and PWA update gates. `npm audit --omit=dev` also returned exit 0.

## Menu usability iteration on the same tablet

The menu-first usability build kept version `0.13.0-test.1` and the same signing certificate. The first iteration APK SHA-256 was `57558B902777BFE8BF1A8BAD5F35E7C0F598E4EC9E0B34397BC7FA37BF50FA7D`. Gradle reported `BUILD SUCCESSFUL in 1m 35s`, `apksigner` verified v1/v2/v3, and `adb install -r` returned `Success` on serial `3404d221b89fc1f1`.

I used the installed UI to create `Ceramics` with `TabletMug` at `28`, review a pasted `Basket, 24`, change its price to `240`, and confirm Preview and Copy contained `Basket` at `240`. After force stop and relaunch, Build showed `Ceramics, 2 items`. The saved page list showed the synthetic `DeviceQA` page and the existing `Untitled page`; neither was deleted. [The iteration audit](2026-10-01-usability-iteration-audit.md) has screenshots and exact steps. USB stay-awake was returned to `0` after testing. The full verification gate for this iteration passed with 1,762 tests and 63 accessibility tests.

After the pager focus fix, the final APK built with `BUILD SUCCESSFUL in 2m 21s`. Its SHA-256 is `073EDF47E7562C9CFCD2F1C344090DC4E583890961BBBD86D7A76542F0056FCC`, with 3,410,901 bytes. `apksigner` verified v1/v2/v3 and certificate SHA-256 `c952b39cfd7b335efe5269fb25b8a17e4c6aaeb757aa1d1e5453e45b123018e0`; `aapt` reported API 23 minimum, versionCode 19, and versionName `0.13.0-test.1`. Reinstall returned `Success`. A force stop and cold launch showed [`DeviceQA` and `Ceramics, 2 items`](media/2026-10-01-ux-after-tablet-finalbuild.png) on an awake screen. UIAutomator did not expose text inside this WebView in its XML, so the final state was checked from the screenshot. USB stay-awake was again restored to `0`.
