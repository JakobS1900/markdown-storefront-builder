# Quickstart: The Setup Wizard

**Feature**: 027 | **Date**: 2026-09-08

How to drive this once it exists, and what to actually check. Written for the
session that picks this up, and for the on device pass at the end.

## Before anything

```powershell
npm run verify
```

From PowerShell, whole, unpiped. `Select-Object -First N` corrupts the exit code
you are reading and makes a green gate look failed. Expect the numbers in
`docs/HANDOFF.md` under "Current state".

## The five minute check, in a browser

```powershell
npx vite --port 5177 --strictPort
```

Note it prints its own port. `npm run dev -- --port 5177` does not work: npm
passes `5177` through as a positional argument, vite reads it as a root
directory, and you get a server on 5173 serving nothing.

1. Open it at 390px wide, with no saved pages.
2. The empty state offers the wizard **and** still offers the starting point
   picker. If the picker is gone or is behind the wizard, FR-128 is broken.
3. Answer every question. The page that opens carries your store name where a
   reader will see it, and your first item with its price.
4. Go to Copy. The store name is in the compiled output. **This is the check
   that matters most**: a name that appears in the editor and not in the output
   is the exact defect FR-121 exists to prevent, and it looks fine until
   somebody sends the page to a customer.
5. Go back to the empty state, run the wizard again, and skip every question.
   A usable page still opens.
6. Run it a third time and abandon halfway. Nothing was created.

## The check that is easy to skip and should not be

**Open a page with real work in it first, then run the wizard.** Answer some
questions, then abandon. The page you had must be untouched, and running the
wizard to completion must leave it untouched too and open the new page
alongside.

This is Principle V and it is the seam a per chunk review structurally cannot
see, because the wizard side is correct on its own and `openBackup` is correct
on its own. Feature 024's holistic review found two defects of exactly this
shape.

## Proving the gates measure something

Do not skip this. Two gates in this project turned out to be measuring nothing,
and the contrast gate was twice found green about a surface it never laid out.

- **Break the field example test**: remove the hint from Item and confirm it
  goes red naming that field. A test that only counts hints can be satisfied
  with noise.
- **Break the contrast guard**: stop the gate opening the wizard and confirm it
  refuses to report a pass, rather than passing with a smaller number.
- **Break the escaping test**: put a corpus string through the store name and
  confirm it is caught.
- **Break FR-121**: write the store name only to `document.title` and confirm a
  test fails. If nothing fails, the test is checking the field rather than the
  output, which is the wrong thing.

## On the device

Follow `docs/WORKFLOW.md`. The traps that have each cost real time here:

- `$env:JAVA_HOME="C:\Program Files\Java\jdk-21"` for the build only. The
  machine's `JAVA_HOME` points at JDK 8 and Gradle needs 21.
- `npm run android:sync` or the APK ships stale assets **while reporting
  success**. Check a filename inside the APK against `app/dist` afterwards.
- Bump `versionCode` with the Edit tool. `Set-Content` writes a BOM into
  `build.gradle` and Gradle then dies in about a second with no useful message.
- Install with `-r` and the same key. Never uninstall to install: uninstalling
  deletes every page the owner has saved.
- Check `dumpsys power` for `mWakefulness` **immediately before** each
  `screencap`, not once at the start. A screenshot of a sleeping phone is a
  white PNG under about 20 kB, and it has been misread as a broken app before.
  `adb shell svc power stayon usb` holds it awake, and set it back to `false`
  afterwards because it is the owner's setting.
- `MSYS_NO_PATHCONV=1` for `adb shell` under Git Bash, including `screencap`.

What to look at on the handset, at 390px in both palettes: every question fits
without horizontal scrolling, every control clears 44 by 44, and the device back
gesture dismisses the wizard before it leaves the surface rather than after.
