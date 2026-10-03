# Android 6 document picker check, 2026-10-02

## Cause and change

On the Samsung SM_T700, Android 6.0.1, API 23, the existing text file button opened Dropbox's sign-in screen. Capacitor 7's `BridgeWebChromeClient` passed `FileChooserParams.createIntent()` to Android. A direct `ACTION_GET_CONTENT` test also opened Dropbox. A direct `ACTION_OPEN_DOCUMENT` test opened Android DocumentsUI with Downloads available. The app now uses that system document action for text and JSON file inputs. Image inputs retain Capacitor's media path.

The document request uses `*/*` because a provider may report a Markdown or CSV file with a generic MIME type. The page and price list import controls reject an unrelated file name and MIME type before reading it, and show a visible explanation for an unsupported or unreadable file. The existing backup parser still validates JSON. Cancellation returns a null selection to the WebView, and a missing document picker falls back to Capacitor's chooser. Android's [Storage Access Framework guide](https://developer.android.com/training/data-storage/shared/documents-files) documents `ACTION_OPEN_DOCUMENT` on API 19 and newer, without a storage permission.

## Verification

The two new web regression tests failed on the old file handlers, then passed after validation was added. Three visible-feedback assertions then failed on the old UI and passed after the message was added. The focused run passed 94 tests in two files. The final `npm run verify` exited 0, covering typecheck, lint, the full test suite, secret and dash scans, 65 accessibility tests, light and dark contrast, menu-file, and PWA update. The Android debug build reported `BUILD SUCCESSFUL in 5m 47s`; the final synced signed release build reported `BUILD SUCCESSFUL in 48s`. Code review caught and removed a `String.join` call before tablet installation because it may be unavailable on API 23.

The signed APK at `android/app/build/outputs/apk/release/app-release.apk` is `0.13.0-test.3`, versionCode 21, minSdk 23, SHA-256 `8AF61E76F00A1BFCE6A1C0D1980C491F9E30FDB50959E79698EECF700D893566`. `apksigner verify` exited 0 and reported v1, v2 and v3 signatures true. Its certificate SHA-256 is `c952b39cfd7b335efe5269fb25b8a17e4c6aaeb757aa1d1e5453e45b123018e0`, unchanged from the installed build. `adb install -r` returned `Success`; `dumpsys package` reported versionCode 21 and versionName `0.13.0-test.3`.

On cold launch, the previously saved page still showed `Open Prices: 1 item`. The real [Read a text file from this device button](media/2026-10-02-android6-picker-fixed-paste.png) opened [Android DocumentsUI](media/2026-10-02-android6-picker-fixed-document.png), confirmed by `mCurrentFocus=com.android.documentsui/.DocumentsActivity`. Selecting an unrelated PNG returned to the app with the [paste box still empty and an explanation below the button](media/2026-10-02-android6-picker-fixed-reject.png). Pressing Back to cancel returned to the app; opening and cancelling again also worked. An Android keyboard suggestion briefly filled the page title during navigation. The title was cleared and the saved indicator returned before the picker check.

## Limits and cleanup

Files copied to `/sdcard/Download` with ADB did not appear in this tablet's DocumentsUI Downloads provider, even with the all-files filter, so selecting and reading a downloaded `.md` file remains unverified. An optional attempt to open a local test download in Chrome was rejected by automatic command review with the message `blocked by policy`; no further reason was supplied. The temporary HTTP server was stopped, the ADB reverse port was removed, and the temporary HTML file was removed. USB stay-awake was restored to `mStayOn=false` and setting `0`.

Capacitor 7 [supports Android API 23 and newer but requires WebView Chrome 60 or newer](https://capacitorjs.com/docs/v7/android). This tablet's updated WebView 106 ran the app. Its former WebView 49 remains outside that native runtime's support.
