/**
 * Registers the service worker, and tells the artist when a new version is
 * ready rather than swapping it underneath them silently.
 *
 * Registration is deliberately late and failure is deliberately quiet. The tool
 * works perfectly without a service worker; offline support is a bonus, not a
 * dependency, so a browser that refuses it should get the app anyway rather
 * than an error about a feature they did not ask for.
 */
import { announce } from "./ui/dom.js";

export function registerServiceWorker(): void {
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
