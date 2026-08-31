# Feature Specification: Direct Uploads, and an Android App

**Feature Branch**: `009-imgur`
**Shipped**: 2026-08-25, merged as `b05d6f0`
**Status**: Shipped. Specified retrospectively on 2026-08-31, see `specs/README.md`.
**Input**: Remove the upload proxy in favour of a direct upload, and wrap the app natively so it can be installed and used as an app.

## What this feature is

Two things that arrived together because they were both about the app being
something you have rather than something you visit.

The proxy from feature 006 was removed. It existed to hold a key on a server,
and a serverless function is a deployment, a runtime, and a thing that can be
down, in a project whose entire pitch is that it needs no server. Uploads now go
straight to the host from the browser. The consequence of that, that a key in a
public bundle is a shared liability, is worked through in feature 006 and ends
with the published build shipping no key at all.

The app is also wrapped with Capacitor, so it installs on Android with a
launcher icon and a real file picker. The web build was already offline and
local, so there was nothing for a native layer to add beyond those two things.

## User Scenarios & Testing

### User Story 1 - It is an app on my phone (Priority: P1)

The artist installs it, taps the icon, and edits their page with no browser
chrome and no network.

### User Story 2 - It does not serve me a stale copy of itself (Priority: P1)

An update installs and the next launch runs the new version.

### Edge Cases

- The device sleeping while the app is open. Android freezes a hidden WebView,
  which stops its task queue entirely. Not a defect in the app, and the source
  of one false alarm during verification.
- A build with no upload key. The upload control is absent rather than broken.

## Requirements

### Functional Requirements

- **FR-009-1**: The native build MUST NOT register a service worker, and MUST
  tear down any registration and cache left by a previous version.
- **FR-009-2**: The native shell MUST run the same code as the web build. No
  platform branches in the app beyond the shell detection itself.
- **FR-009-3**: Uploads, where a key is configured, go directly from the client.
  There is no server component in this project.

## What building an APK does not prove

It builds, and nobody has tapped a button in it. That was written in the
repository at the time and it was the right thing to write.

Verification was therefore done on a physical Moto G7 over adb, driving the
WebView's own debugger: add a section, type a name, kill the app, relaunch it,
read the document back out of storage, compile, copy, and paste it back to prove
the text reached the system clipboard. Recorded in `63ccbec`.

The first result was a false alarm and the way it was caught is the useful part.
Nothing persisted, and the obvious reading was a broken storage layer on
Android. Before touching any code the app was instrumented: a 50ms timer never
fired while promises still resolved. That is not a storage bug, it is a stopped
task queue. The screen had switched off. One command to wake it and storage
opened first try. It had already been reported as a real defect and the report
had to be withdrawn.

## What was wrong with it, found later

The service worker shadowing problem was found here and fixed here (`13c701f`).
Everything else the device found is feature 010, because it kept finding things
for another six days.

## Dependencies

Features 004 to 006.
