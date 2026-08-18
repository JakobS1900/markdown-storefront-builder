# The upload proxy

The only server this product has. It exists for one reason: the key that talks
to the image host must never reach a browser.

The app works without it. Address entry shipped first, in roadmap 3.1, and if
this is not deployed the upload control is simply not offered rather than
present and broken. Turning it off later breaks nothing.

## What is verified and what is not

**Verified by tests** (`proxy/tests/upload.test.ts`, 26 of them): file type from
magic bytes rather than the declared header, the byte ceiling enforced both on
the declared length and the real one, the per-address rate limit, origin
checking with no wildcard, and that no response on any failure path mentions the
key.

**Verified in a real browser** against `dev-server.mjs`: an actual PNG picked in
a file dialog, re-encoded through a canvas, posted to the real handler, stored,
and the returned address loaded back into the page as a working image. Then the
proxy was killed and the same upload produced an honest message naming address
entry as the alternative.

**Not verified**: the hop to the real image host in `worker.ts`. That needs an
account and a deployment, neither of which exists yet. It is written from
catbox.moe's documented API and marked unverified in the source. Whoever deploys
it first should check the response shape before trusting it, and record the
result in `docs/WORKFLOW.md`.

## Running it locally

```
npx tsc -p proxy/tsconfig.json
node proxy/dev-server.mjs 8787
```

The image host is stubbed: uploads are written to `proxy/.dev-uploads` and
served back, so the whole round trip is observable. Then build the app pointed
at it:

```
VITE_UPLOAD_URL=http://localhost:8787/upload npm run build:app
```

## Deploying

On Cloudflare Workers, with `proxy/src/worker.ts` as the entry point:

```
wrangler secret put UPLOAD_KEY
wrangler deploy
```

`ALLOWED_ORIGINS` and `UPLOAD_ENDPOINT` are plain variables. `UPLOAD_KEY` is a
secret and must never be committed, printed, or returned in a response.

A deployment with no `UPLOAD_KEY` refuses every request with a 503 rather than
half working, because a missing key is an operator mistake and uploads that
silently go nowhere are worse than uploads that visibly do not.
