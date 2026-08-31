/**
 * Making the system back gesture mean something.
 *
 * The app has three surfaces and no URLs, so the WebView had no history and
 * Android's back button finished the activity from every screen. Measured on a
 * Moto G7: back from Preview, from Copy, and from Build all left the app. From
 * Build that is correct. From the other two it discards the app when the person
 * meant to step back to Build.
 *
 * Switching surface now leaves a history entry, which gives the WebView
 * somewhere to go and gives the native shell something to send back to. Build
 * pushes nothing, so back from the first screen still leaves, which is what an
 * app is supposed to do.
 */
import { setSurface, type Surface } from "./store.js";

const SURFACES: readonly string[] = ["build", "preview", "export"];

function asSurface(value: unknown): Surface | undefined {
  return typeof value === "string" && SURFACES.includes(value) ? (value as Surface) : undefined;
}

/** Records a move between surfaces so that back has somewhere to return to. */
export function rememberSurface(surface: Surface): void {
  const current = asSurface((history.state as { surface?: unknown } | null)?.surface);
  if (current === surface) return;
  // Build is the bottom of the stack. Pushing for it would mean back has to be
  // pressed twice to leave the app from the first screen.
  if (surface === "build") return;
  history.pushState({ surface }, "");
}

/** Sends a system back gesture to the surface its history entry names. */
export function startSurfaceHistory(): void {
  window.addEventListener("popstate", (event: PopStateEvent) => {
    const state = event.state as { surface?: unknown } | null;
    setSurface(asSurface(state?.surface) ?? "build");
  });
}
