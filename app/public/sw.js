/**
 * The service worker.
 *
 * The whole tool runs offline apart from nothing, because there is no server to
 * be offline from. Storage is local, compilation is local, and the only network
 * request the app makes is fetching itself. So the job here is narrow: keep the
 * shell available so the artist can open their page on a train.
 *
 * Two rules shape the caching.
 *
 * The app shell is cache-first, because it changes only when a new version is
 * deployed, and waiting on the network for files we already have would make a
 * good connection feel slow and a bad one feel broken.
 *
 * A new version takes over immediately. The alternative, waiting for every tab
 * to close, means an artist who keeps the tab open for a week never gets a fix.
 * That is safe here because there is no server the old and new versions could
 * disagree with, and the document format itself refuses anything it does not
 * understand.
 *
 * IMPORTANT: the version below must change whenever the build output changes,
 * or returning visitors keep the old shell. The build stamps it.
 */
const VERSION = "__BUILD_ID__";
const SHELL = `shell-${VERSION}`;

self.addEventListener("install", (event) => {
  // Precache nothing by name. Hashed asset filenames change every build, so a
  // hardcoded list rots silently. The shell fills on first visit instead, which
  // costs one online load and can never be stale.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache from a previous version. Storage is the artist's, and
      // leaving dead shells in it is taking space they did not agree to.
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== SHELL).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only GET, and only our own origin. An image the artist links to belongs to
  // whoever hosts it, and caching someone else's picture without being asked is
  // not ours to do.
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL);
      const hit = await cache.match(request);

      if (hit !== undefined) {
        // Refresh in the background so the next load is current, but answer now.
        void fetch(request)
          .then((fresh) => (fresh.ok ? cache.put(request, fresh.clone()) : undefined))
          .catch(() => undefined);
        return hit;
      }

      try {
        const fresh = await fetch(request);
        if (fresh.ok) await cache.put(request, fresh.clone());
        return fresh;
      } catch (error) {
        // Offline with nothing cached. A navigation falls back to the shell so
        // the app still opens; anything else fails honestly rather than being
        // answered with something wrong.
        if (request.mode === "navigate") {
          const shell = await cache.match("./index.html");
          if (shell !== undefined) return shell;
        }
        throw error;
      }
    })(),
  );
});
