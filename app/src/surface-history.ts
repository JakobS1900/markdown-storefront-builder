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
import { closeSidebar, getState, setSurface, type Surface } from "./store.js";

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

/**
 * Gives the back gesture something to consume when the drawer opens.
 *
 * Without an entry of its own, back on the Build surface leaves the app before
 * any `popstate` fires, because Build deliberately pushes nothing and back from
 * the first screen is supposed to leave. The drawer would then be dismissed by
 * closing the app, which is not dismissing it.
 *
 * The current surface is copied onto the entry so `rememberSurface` above still
 * reads the right value while the drawer is open. Without that it would see an
 * entry with no surface and treat the seller as being on the first screen.
 */
export function rememberSidebarOpen(): void {
  const current = asSurface((history.state as { surface?: unknown } | null)?.surface);
  history.pushState({ surface: current, sidebar: true }, "");
}

/** Whether the entry on top of the stack is the drawer's own. */
export function sidebarOwnsHistory(): boolean {
  return (history.state as { sidebar?: unknown } | null)?.sidebar === true;
}

/**
 * Closes the drawer, however the seller asked for it.
 *
 * Escape, the backdrop, the close control and choosing a page all come through
 * here, and they all go back through history rather than closing the state
 * directly. One path, so the entry pushed on opening is always consumed exactly
 * once and the stack cannot deepen by a press per open.
 *
 * The state change itself happens in the `popstate` handler below, which is
 * also where the system gesture lands. That is what keeps the two identical
 * rather than merely similar.
 */
export function dismissSidebar(): void {
  if (sidebarOwnsHistory()) history.back();
  else closeSidebar();
}

/** Sends a system back gesture to the surface its history entry names. */
export function startSurfaceHistory(): void {
  window.addEventListener("popstate", (event: PopStateEvent) => {
    // The list of pages goes first, because it is what the seller is looking
    // at. Back with a drawer open means close the drawer, in every application
    // anybody has used, and navigating underneath it instead would move the
    // page they were about to choose from out from behind it.
    //
    // It returns rather than falling through, so the surface is untouched. The
    // entry this consumes is the one pushed when the drawer opened, which
    // leaves the history exactly as deep as it was before.
    if (getState().sidebarOpen) {
      closeSidebar();
      return;
    }

    const state = event.state as { surface?: unknown } | null;
    setSurface(asSurface(state?.surface) ?? "build");
  });
}
