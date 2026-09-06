# Quickstart: seeing the menu file work

**Feature**: 024-menu-file
**Date**: 2026-09-06

How to prove this feature does what it claims, in the order that catches
problems earliest. Every command runs from **PowerShell**, from the repository
root. `rtk` intercepts the Bash tool and has reduced a whole test run to
`PASS (1) FAIL (0)` and `git status --short` to the word `ok`, so a gate's
result read through it is not evidence.

## The gate

```powershell
npm run verify
```

Typecheck, lint, test, secret scan, dash scan, a11y, contrast, service worker
update. Run it whole and unpiped: `Select-Object -First N` terminates the
pipeline early and PowerShell reports that as a non-zero exit, so a gate that
printed entirely green can still look failed.

Baseline before this feature, on `965fc5b`: 64 test files, 1092 tests, a11y 34,
`light`/`dark` both 164 elements and 12 sections with 0 contrast failures, PWA
gate clean.

Do not run anything else while it is going. Several tests sit at 3.8 to 4.7
seconds against a 5000ms timeout, and a timed-out test pollutes the rest of its
own file, turning one timeout into what look like three assertion failures.
Re-run a file alone before believing a failure.

## Breaking each new gate, which is the part that matters

This project has shipped two gates that measured nothing. A passing test is not
evidence that a check works; making the check fail on purpose is.

**The lock.** Temporarily make the emitter publish a local picture for a paste
target, the way `pricedAs` was temporarily made to append `cost`. Then:

```powershell
npx vitest run engine/tests/compile/local-image-never-published.test.ts
```

It MUST fail, and it must fail for the paste targets while the `MENU_FILE` case
stays green, because that pair is what makes it discriminating rather than a
test that would pass on an empty document. Revert.

**The saved file's inertness.** Run the hostile text corpus through the export
and assert nothing executable survives. Break it by having the serializer write
one field as markup rather than text; the corpus test MUST catch it. Revert.
This is also the check that settles the disagreement recorded in the plan's
Complexity Tracking: if it cannot be made to pass, the export needs its own
emitter rather than reusing the preview renderer.

**Quota.** Force the refusal path with a stub quota rather than by filling a
real disk, and read the message. It must name what is in use and what to do. A
raw `QuotaExceededError` string reaching the seller is the defect Principle V
names, so seeing the raw string means the branch is not wired.

## Seeing it by hand, in the browser

```powershell
npm run dev
```

1. Open a starting point, or the example page.
2. Add a picture from the device to a price row. Confirm you were told where it
   would and would not appear **before** choosing it, not after.
3. Preview with `rentry` selected. The picture is absent and a warning names it
   and says where it does appear. This is the lock teaching itself.
4. Preview the menu file. The picture is there.
5. Save the menu file. Note the size you are told.
6. Turn networking off in devtools, open the saved file from disk. Layout,
   styling and the local picture are all present.
7. Narrow to 390px. The page does not scroll sideways.

After any `npm run build:app`, a browser that already loaded the app keeps
serving the previous build from the service worker. That is `pwa-update` working
correctly, not a broken fix. Unregister and clear caches, or reload twice, or a
CSS change will measure as having done nothing.

## On the device, which is where this actually gets used

The owner uses the Android build, and the largest open risk in this feature is
whether a multi megabyte string survives the JavaScript to native bridge in
`app/src/files.ts`. That question is answered here and nowhere else.

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
npm run android:sync
cd android; .\gradlew.bat assembleDebug
```

`JAVA_HOME` is set for the build only. The machine's global value is JDK 8,
which Gradle refuses, and JDK 17 fails differently with "invalid source release:
21".

`npm run android:sync` is the step that must not be skipped. `assembleRelease`
packages whatever sits in `android/app/src/main/assets/public`, which only
`cap sync` updates, and it reports BUILD SUCCESSFUL either way. Version 0.4.0
shipped four day stale assets exactly this way. Verify with:

```powershell
[IO.Compression.ZipFile]::OpenRead($apk).Entries | ? FullName -like '*public/assets/*.css'
```

Then, in order:

1. `adb devices -l`, and `adb shell dumpsys power` for `mWakefulness`.
2. `adb shell svc power stayon usb`, and set it back to `false` afterwards. It
   is the owner's device setting, not ours.
3. Bump `versionCode` and install with `-r` and the same key. **Never uninstall
   to install.** That erases the owner's saved pages.
4. `MSYS_NO_PATHCONV=1` for `adb shell` and `adb pull`, or `screencap` is handed
   a rewritten Windows path and prints its usage text instead of capturing.
5. Re-check wakefulness **immediately before each capture**. A screenshot under
   about 20 kB is a sleeping screen until proven otherwise. Three identical
   white PNGs were once read as the app failing to render, and a rebuild, a
   reinstall and a service worker investigation followed a screen that had
   simply timed out.
6. Save a menu file with several photographs in it and open it. This is the real
   test. If the bridge cannot carry it, research D4 has the order of fallbacks:
   smaller export edge first, then chunk the call, and only then reconsider
   embedding.
7. Remove anything typed into the owner's pages afterwards, addressing controls
   by accessible name and never by position. Position has destroyed the owner's
   work here once already.

## What "done" means

The command was run, the output was read, and it is quoted. "Should work" is not
done, and neither is a green run nobody looked at.
