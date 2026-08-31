# Feature Specification: Offline and Installable

**Feature Branch**: `005-pwa`
**Shipped**: 2026-08-18, merged as `f0dbab7`
**Status**: Shipped. Specified retrospectively on 2026-08-31, see `specs/README.md`.
**Input**: Roadmap item 2.5. Service worker, offline app shell, installability.

## What this feature is

The app already stored everything locally and talked to no server, so it was
offline in every sense except that loading it needed the network. This closes
that gap and makes it installable to a home screen.

Small on purpose. There is no sync, no background work, and no cache of anything
but the app's own files, because there is nothing else to cache: the artist's
page lives in IndexedDB and never leaves the device.

## User Scenarios & Testing

### User Story 1 - It opens on a train (Priority: P1)

An artist installs the app, loses signal, opens it, and can still edit their
page and copy the output.

### User Story 2 - It updates without being reinstalled (Priority: P2)

A new version is deployed. The next launch after that serves the new one rather
than the cached old one indefinitely.

### Edge Cases

- A browser that refuses service workers. Registration failure is caught and the
  app works normally, just without offline loading.
- A stale cache after a deploy. The worker is versioned by a build id stamped at
  build time, so a new build invalidates the old cache.

## Requirements

### Functional Requirements

- **FR-005-1**: The app shell MUST load with no network once it has been opened
  at least once.
- **FR-005-2**: The service worker MUST be versioned by a build identifier, so a
  deploy cannot be shadowed indefinitely by a cached copy.
- **FR-005-3**: Registration failure MUST NOT break the app.
- **FR-005-4**: The manifest MUST declare a name, icons, start URL, scope, and a
  display mode sufficient for installation.

## Success Criteria

- **SC-005-1**: Stopping the server and reloading still yields a working editor.
  Verified by hand on 2026-08-18: the server was stopped, the page reloaded from
  cache, and a section was added with no network.
- **SC-005-2**: The manifest, the icons, and the worker source are checked by
  `app/tests/pwa.test.ts`, so the pieces that make the above possible cannot
  quietly rot.

## What was wrong with it, found later

The service worker earns its place on the web and is a liability inside the
Android package, where every asset is already on local disk. It cached nothing
useful and shadowed the app's own files with the previous build, so an install
containing one bundle served the one before it and the update only appeared on a
second launch. Declining to register it would have fixed nothing for anyone who
already had the app, since the registration and its cache survive an update, so
the native build tears both down. Fixed in feature 009, commit `13c701f`.

## Dependencies

Feature 004. There has to be an app before it can be installed.
