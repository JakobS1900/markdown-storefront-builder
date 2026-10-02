# Android 6 import correction check, 2026-10-02

## Build and install

The connected tablet was Samsung SM_T700, Android 6.0.1, API 23, with Android System WebView 106.0.5249.126. I ran `npm run android:sync` in PowerShell, then `assembleRelease` with JDK 21. Gradle reported `BUILD SUCCESSFUL in 2m 48s`. The signed APK is `android/app/build/outputs/apk/release/app-release.apk`, version `0.13.0-test.2`, versionCode 20, minSdk 23. Its SHA-256 is `780A782E7D5E1077E9CB6F4A49647808334B95695A61BF9E5D5A207EC90DE4C7`.

`apksigner verify --verbose --print-certs` exited 0 and reported v1, v2 and v3 signing true. The certificate SHA-256 was `c952b39cfd7b335efe5269fb25b8a17e4c6aaeb757aa1d1e5453e45b123018e0`, matching the installed test build. `aapt dump badging` reported versionCode 20 and sdkVersion 23. `adb -s 3404d221b89fc1f1 install -r` returned `Success`, preserving app data. The installed package then reported version `0.13.0-test.2`.

## Device task

On cold launch, the existing `DeviceQA` page still showed `Ceramics, 2 items` in Build. I opened Paste a page and entered the fictional line `Blue mug - 25` with ADB keyboard input. It stayed Text, which is the safe interpretation of a price without a currency marker. I opened Adjust as prices, explicitly converted the source row, corrected Item to `Blue bowl`, and entered Price `35`. The panel showed `Proposed: Blue bowl. Amount: None. Price: 35. Details: None. Converted to Prices.`

I pressed Add as a new page. Build showed `Open Prices: 1 item`; Preview showed an Item and Price row of `Blue bowl` and `35`. After force-stop and cold launch, Build still showed the saved item. The pages drawer listed three pages: the new untitled test page, the prior `DeviceQA` page, and a prior untitled page. I did not remove any saved page. The screenshots show the [existing page before import](media/2026-10-02-android6-final-home.png), [corrected row](media/2026-10-02-android6-final-correction.png), [saved Build](media/2026-10-02-android6-final-saved.png), [saved Preview](media/2026-10-02-android6-final-preview.png), [cold launch](media/2026-10-02-android6-final-cold.png), and [page drawer](media/2026-10-02-android6-final-pages.png).

The Android 6 accessibility dump exposed the WebView as one node, so this pass used ADB taps, keyboard input and visual screenshots. Chrome Task D separately exercised four mapped tables, two detached headings and four detached names with eight amount-price pairs at 320 and 390 CSS pixels. This tablet task establishes that the correction panel renders, accepts typed edits, saves, previews, and survives a cold launch on API 23 with WebView 106. It does not establish the same result on Android System WebView 49.

I prepared the fictional [tablet menu file](fixtures/2026-10-02-tablet-menu.md) in Downloads. The file input on this tablet opened Dropbox's first-run screen instead of a local file browser, so the prepared file was not selected. I returned without changing the tablet's app associations and used the text entry route. Local file selection on this device remains unverified. I restored USB stay-awake to `mStayOn=false` and `mStayOnWhilePluggedInSetting=0` after the check.
