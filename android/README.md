# The Android app

The same app, wrapped natively with Capacitor. There is no second codebase and
no second implementation: `app/` is the whole product, and this is a shell that
loads it.

That was the point of building it as an offline PWA first. Storage, compilation,
and preview are already local, so there is nothing for a native layer to add
except the parts Android provides itself: a launcher icon, a real file picker,
and a home screen presence that does not depend on the browser.

## Building it

Needs a JDK 17 or newer and the Android SDK. Both were already installed here;
JDK 8 is also on this machine and Gradle will refuse it.

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
$env:ANDROID_HOME = "F:\Programming\Android\Sdk"

npm run android:apk     # builds the web app, syncs it, produces a debug APK
npm run android:open    # opens the project in Android Studio
```

The APK lands at `android/app/build/outputs/apk/debug/app-debug.apk`. Copy it to
a phone and install it, or use `adb install`.

## What is verified and what is not

**Verified**: the project builds, the APK is produced, and the web assets are
inside it. Checked by opening the APK and listing what it contains.

**Not verified**: it has never run on a device or an emulator. Nobody has tapped
a button in it. The Gradle build succeeding is not the same as the app working,
and the difference between those two is exactly where this project has found
most of its bugs.

Two things to check first on a real device, because they are the ones most
likely to differ from a browser: whether IndexedDB persists across app restarts
inside the WebView, and whether the file picker returns something
`createImageBitmap` can read.

## Release builds

The debug APK is signed with a debug key and cannot go on the Play Store. A
release build needs a keystore, which is a real secret and must never be
committed. That is deliberately not set up here.
