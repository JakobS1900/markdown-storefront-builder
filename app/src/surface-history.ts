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

/**
 * Records a move between surfaces so that back has somewhere to return to.
 *
 * At most one entry ever exists beyond the first screen, which is the part that
 * took a second look on the phone. Pushing for every move gives plain browser
 * history: back retraces, so Build then Preview then Copy then back landed on
 * Preview rather than Build, and toggling tabs ten times needed ten presses to
 * leave the app. The earlier check missed it by relaunching between every case,
 * so the stack never had a chance to grow.
 *
 * Build is the first screen. Back from anywhere else returns to it, back from
 * it leaves, and wandering between the other two never deepens anything.
 */
export function rememberSurface(surface: Surface): void {
  const current = asSurface((history.state as { surface?: unknown } | null)?.surface);
  if (current === surface) return;

  if (surface === "build") {
    // Give the entry back rather than stacking another on top of it. The
    // popstate that follows sets the surface, which is the same thing the
    // caller is about to do, so doing it twice costs nothing.
    if (current !== undefined) history.back();
    return;
  }

  if (current === undefined) history.pushState({ surface }, "");
  else history.replaceState({ surface }, "");
}

/** Sends a system back gesture to the surface its history entry names. */
export function startSurfaceHistory(): void {
  window.addEventListener("popstate", (event: PopStateEvent) => {
    const state = event.state as { surface?: unknown } | null;
    setSurface(asSurface(state?.surface) ?? "build");
  });
}
