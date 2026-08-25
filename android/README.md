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

**Verified on hardware** on 2026-08-25, on a Moto G7 running Android 10 (API 29)
with WebView 150, driven over adb. The whole loop an artist actually performs:

| Step | Evidence |
|---|---|
| App launches | No `FATAL` or `AndroidRuntime` in logcat, `location.href` is `https://localhost/` |
| Modern syntax survives the WebView | `private-field:5 at():3 nullish:ok` |
| A section can be added | Adding "About you" took the block count from 0 to 1 |
| Editing saves | Typing a name showed `Saved` |
| It persists across a cold start | After `am force-stop` and relaunch under a new pid, IndexedDB held `"displayName": "Ari on phone"` and the row read `Edit About you: Ari on phone` |
| It compiles | The Copy tab produced `### Ari on phone\n` |
| Copy reaches the OS clipboard | A real `input tap` gave "Copied. Now paste it into your page.", and `KEYCODE_PASTE` into a field returned `### Ari on phone` |

So the IndexedDB question this section used to raise is answered: storage
survives a cold start inside the WebView.

**Still not verified**: the file picker, and therefore whether an image chosen
on a phone is something `createImageBitmap` can read. That path needs an Imgur
Client-ID at build time, and this build has none, so the upload control is not
rendered at all and there was nothing to tap.

### The trap, if you test this yourself

Android freezes a WebView whose screen is off. While the phone was dozing,
`setTimeout` never fired and `indexedDB.open()` fired no event at all: not
success, not error, not blocked. Storage looked broken and was not. Wake the
screen before driving the app, or you will spend an hour debugging the phone's
power manager instead of the code.

```bash
adb shell input keyevent KEYCODE_WAKEUP
adb shell dumpsys display | grep mScreenState    # want ON, not OFF
```

To drive the app, forward the WebView's debugger and speak CDP to it:

```bash
PID=$(adb shell pidof com.rade.storefrontbuilder)
adb forward tcp:9333 localabstract:webview_devtools_remote_$PID
curl -s http://localhost:9333/json/list          # gives webSocketDebuggerUrl
```

Two things cost time there. Each `Runtime.evaluate` shares one global scope, so
a bare `const x` in one call makes the next call a `SyntaxError`; wrap each
snippet in an IIFE. And a scripted `.click()` is not a trusted user gesture, so
the clipboard write only succeeds under a real `input tap`. Tapping needs
`screen_y = css_y * devicePixelRatio + status_bar_height`, which was 111 device
pixels on this phone; measure it by recording a `pointerdown` and comparing.

## Release builds

The debug APK is signed with a debug key and cannot go on the Play Store. A
release build needs a keystore, which is a real secret and must never be
committed. That is deliberately not set up here.
