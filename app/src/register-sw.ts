/**
 * Sets up offline support in a browser, and deliberately tears it down inside
 * the native shell.
 *
 * Registration is late and failure is quiet. The tool works perfectly without a
 * service worker; offline support is a bonus, not a dependency, so a browser
 * that refuses it should get the app anyway rather than an error about a
 * feature nobody asked for.
 *
 * Inside the Android app the worker is not a bonus, it is a liability. Every
 * asset is already on local disk inside the APK, so there is no network to be
 * offline from and nothing for a cache to save. What it does instead is shadow
 * the APK's own files with an older copy of itself, so installing an update
 * shows the previous version until the app is launched a second time. Observed
 * on a Moto G7 on 2026-08-26: a freshly installed APK served the bundle from
 * the build before it.
 */
import { announce } from "./ui/dom.js";

/**
 * Whether this is the native shell rather than a browser.
 *
 * Asks Capacitor directly instead of sniffing the URL. The app is served from
 * https://localhost inside the WebView, and a developer running the site on
 * localhost in a browser would be indistinguishable by address alone. Verified
 * on the device: `isNativePlatform()` is true and `getPlatform()` is "android".
 */
function isNativeShell(): boolean {
  const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  return capacitor?.isNativePlatform?.() === true;
}

/**
 * Removes any worker and cache a previous build left behind.
 *
 * Not registering is not enough on its own. An app that has already been
 * installed carries a live registration and a populated cache, and those
 * outlive an update, so without this the devices most affected are exactly the
 * ones that would never be fixed.
 *
 * The page that runs this keeps its existing controller until it next loads,
 * so this launch may still be served from the cache. The one after it will not
 * be, and no launch after that ever will again.
 */
async function removeServiceWorker(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    // Every cache, not just the current one. Nothing in the native shell should
    // be caching anything at all, so any cache here is something to clear
    // rather than something to keep. The origin belongs to this app alone.
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
  } catch {
    // A WebView that refuses either API leaves the app working exactly as it
    // does now. There is nothing to tell the artist and nothing they could do.
  }
}

export function setUpServiceWorker(): void {
  if (isNativeShell()) {
    void removeServiceWorker();
    return;
  }

  if (!("serviceWorker" in navigator)) return;

  // After load, so it never competes with the first paint for bandwidth.
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("./sw.js", { scope: "./" })
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (installing === null) return;

          installing.addEventListener("statechange", () => {
            // "installed" with an existing controller means an update replaced
            // a version that was already running.
            if (installing.state === "installed" && navigator.serviceWorker.controller !== null) {
              announce("A new version of this tool is ready. Reload to use it.");
            }
          });
        });
      })
      .catch(() => {
        // Private browsing and some locked-down configurations refuse to
        // register one. Nothing the artist can act on, so nothing is said.
      });
  });
}
