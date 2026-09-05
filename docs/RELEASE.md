# Releasing

## What exists

A release build of the Android app, signed with a key held outside this
repository, published as a GitHub Release. Roadmap 5.8.

    https://github.com/JakobS1900/markdown-storefront-builder/releases

That is the whole distribution story and it is a deliberate one. See below.

## The key

    C:/Users/Emu/.android-keys/storefront-builder-release.jks
    C:/Users/Emu/.android-keys/storefront-builder.properties

RSA 4096, SHA384withRSA, valid until 16 January 2054. Certificate:

    CN=Markdown Storefront Builder, O=JakobS1900
    SHA-256  c952b39cfd7b335efe5269fb25b8a17e4c6aaeb757aa1d1e5453e45b123018e0

It lives in the user profile and never in this repository, for a reason worth
stating plainly: a secret inside a working tree is one careless `git add -A`
from being public forever, and this is the one secret in the project that
**cannot be rotated after the fact**. An update signed with a different key will
not install over an app signed with this one. Everybody who installed it would
have to uninstall first, and uninstalling deletes the pages they saved.

**Back up both files somewhere that is not this machine.** That is the whole of
the disaster recovery plan, because there is no other one. No support channel
can reissue it.

`.gitignore` also refuses `*.jks`, `*.keystore` and `keystore.properties`. The
key is not in the repository and could not be added by accident either.

## Building a release

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
npm run build:app
cd android
.\gradlew.bat assembleRelease bundleRelease
```

Output:

    android/app/build/outputs/apk/release/app-release.apk       an installable file
    android/app/build/outputs/bundle/release/app-release.aab    for Google Play only

Verify before doing anything with either:

```bash
"$ANDROID_HOME/build-tools/36.0.0/apksigner.bat" verify --verbose --print-certs \
  android/app/build/outputs/apk/release/app-release.apk
```

It must report `Verified using v2 scheme: true` and `v3 scheme: true`, and the
certificate digest must match the one above. v1 is off deliberately: it is the
old JAR signature and is only needed below API 24, which this app does not
support. v3 is on because it is the scheme that carries a rotation lineage, so a
leaked key could later be replaced rather than ending the app.

**Without the key on the machine the build still succeeds** and produces
`app-release-unsigned.apk` instead. That is deliberate, so a fresh clone and CI
can both compile the release variant, and it was verified by pointing
`MDSB_KEYSTORE_PROPERTIES` at a file that does not exist. An unsigned APK will
not install anywhere; check which file you have before sending one to anybody.

## Version numbers

`versionCode` is an integer Android compares to decide what is newer, and it
**must increase on every build anyone else receives**. `versionName` is the
string a human reads.

Currently `versionCode 9`, `versionName "0.6.0"`, both in
`android/app/build.gradle`. Not 1.0: the roadmap has open items and everything
has been verified on one handset by the person who wrote it.

This section said `versionCode 1` and `0.1.0` until 2026-09-05, six releases
after that stopped being true. It is two numbers in one file and it still went
stale, which is the argument for reading the file rather than this paragraph.

## How often

**Tag often. Small releases, not batched ones.** A tag per feature, or per
handful of fixes, rather than a fortnight of work in one.

0.4.0 is why this is written down. It carried seventy commits over four days,
three features, a whole restyle and five design fixes. Nothing went wrong that a
smaller release would have prevented, but one thing nearly did: the first build
of it packaged web assets four days stale, and it was correctly signed and said
BUILD SUCCESSFUL. On a release carrying one feature that is an obvious mistake
with an obvious cause. On a release carrying seventy commits it is a needle, and
the only reason it was found is that somebody thought to compare a filename
inside the APK against the one in `app/dist`.

The cost of a release here is a version bump, a build, a signature check and a
tag. The cost of a batched one is that every problem in it arrives at once and
none of them is obviously yours. Prefer the cheap thing more often.

## Installing a release build over a debug one

It will not install. The two are signed with different keys and Android refuses
the replacement, which is the protection working.

Switching a device from the debug build to the release build means uninstalling
first, and **uninstalling deletes every page saved in the app**. Export a backup
from the Copy screen first, or copy the record out over adb, and check it before
uninstalling rather than after.

## Distribution

GitHub Releases, and nothing else. The signed APK is attached to a tagged
release, the web version needs no install at all, and both are free.

**There is no Play listing and there is not going to be one.** Google charges a
developer registration fee to publish, and this app is not worth paying a toll
to give away. The cost of that decision is real and worth writing down rather
than pretending it away: no store search, no automatic updates, and every
installer has to allow an APK from outside the store once. In exchange, nobody
needs an account to get it and no platform sits between the app and the person
using it.

`bundleRelease` still produces an `.aab`, because the Android build produces one
whether or not anybody wants it. Nothing here uploads it.

Play App Signing would have made the signing key replaceable rather than fatal,
and skipping the store gives that up too. Back the key up. See above.

## What is still missing

- **A second device.** Roadmap 5.9. Everything has been verified on one Moto G7
  on Android 10, and the keyboard inset fix is the least portable thing here.
