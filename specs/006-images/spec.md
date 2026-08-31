# Feature Specification: Images

**Feature Branch**: `006-images`
**Shipped**: 2026-08-18, merged as `78748cb`
**Status**: Shipped, then substantially reversed in feature 009. Specified retrospectively on 2026-08-31, see `specs/README.md`.
**Input**: Roadmap items 3.1 to 3.3. Image addresses with validation and preview, an upload proxy, and the client upload path.

## What this feature is

A commission page without pictures is a price list. This is how an image gets
onto one.

It shipped in two halves. The first is an address field: paste a URL, see a
thumbnail, and be told plainly when the address does not load. The second was an
upload path through a serverless proxy that held an API key, so that an artist
with a file and no hosting could still publish.

The second half no longer exists. See the reversal below, which is the more
interesting half of this document.

## User Scenarios & Testing

### User Story 1 - I paste a link and see whether it worked (Priority: P1)

An artist pastes an image address. A thumbnail appears if it loads. If it does
not, they are told that the address did not load an image and what that usually
means, rather than discovering it after they publish.

### User Story 2 - I have a file, not a link (Priority: P2)

An artist has a picture on their phone and nowhere to put it. Originally: the
app uploaded it and filled in the address. Now: the field tells them where to
upload it themselves and what to paste back.

### Edge Cases

- An address that is not http or https. Refused by the compiler and rendered as
  plain text, never as an image.
- An address that loads something that is not an image. Reported as broken.
- A very large file. Originally bounded by a byte ceiling and a canvas
  downscale before upload.

## Requirements

### Functional Requirements

- **FR-006-1**: An image address field MUST show a preview of what it resolves
  to, or say plainly that it did not resolve.
- **FR-006-2**: Only http and https addresses may become images in the output.
- **FR-006-3**: The field MUST explain how to get an address when the artist
  does not have one.
- **FR-006-4**: An upload path, where present, MUST degrade to address entry
  rather than disappearing when uploads are unavailable.

## The reversal, which is the point of this feature

Uploading worked. The picker opened, the file decoded, the request reached the
host and came back. It was taken out of the published build anyway.

Uploading needs an API key, and a key shipped in a public bundle is shared by
every artist who uses the site. It identifies the application rather than a
person, so nobody's uploads land in anyone's account, but the registration
belongs to whoever made it and so does the responsibility: one artist posting
something against the host's rules gets the whole application banned, and
uploads break for every user at once. The daily quota is shared the same way.

The tidy alternative, asking each artist to register their own key, is worse
than the problem it solves. Registering an API application is harder than
learning the Markdown this entire project exists to remove.

So the published build has no key, no upload button, and a field that tells an
artist where to put an image and how to get its address back. That is what they
already do today, and it costs nobody anything. The upload path is still in the
repository, still tested, and switched on by supplying a key in your own build.
In the published bundle it is not hidden, it is absent: no endpoint, no key
header, no image decoding, verified by fetching the deployed JavaScript and
searching it rather than trusting the build log.

Landed across `e138258` (proxy), `7b391bc` (proxy removed in favour of direct
uploads), and `c79e5a9` (ship with no key).

## What was wrong with it, found later

- The accessibility gate was reporting green on the upload control because that
  control only exists when a key is present at build time and the test run never
  set one. The moment a key existed it failed: the file input had no accessible
  name. A gate that cannot fail is worse than no gate, because it is also
  collecting trust. Fixed in `e2ae1db`.
- A refused upload said "wait a few minutes", which is right for rate limiting.
  Checked against the live API rather than assumed: Imgur answers `POST /3/image`
  with 429 for a bad key, byte for byte identical to a real limit, while
  `/3/credits` answers 403. A build with a dead key would have told every artist
  to be patient, forever. The message now covers both cases.
- The guidance about where to upload was replacing the caller's hint rather than
  being appended to it, so only one of the three fields ever showed it. Fixed in
  `0fe877c`.

## Dependencies

Features 003 and 004. Gallery and profile emitters, and a form to type into.
