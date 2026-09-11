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
import { closeSidebar, closeWizard, getState, setSurface, type Surface } from "./store.js";

const SURFACES: readonly string[] = ["build", "preview", "export"];

function asSurface(value: unknown): Surface | undefined {
  return typeof value === "string" && SURFACES.includes(value) ? (value as Surface) : undefined;
}

/**
 * Takes a layer's claim off the entry BEFORE going back to it.
 *
 * `history.back()` is asynchronous: the entry does not change, and `popstate`
 * does not fire, until the traversal completes. So a second dismiss arriving in
 * that window still saw `wizard: true`, queued a SECOND `history.back()`, and
 * the second one spent the entry belonging to the surface underneath. On Build
 * there is nothing underneath by design, so a real WebView finishes the
 * activity: the app closes on somebody who was trying to shut a panel.
 *
 * That window is not theoretical. `finish` in `wizard.ts` awaits a lazily
 * imported starter document, an IndexedDB write and a page refresh before it
 * dismisses, and every other way out stays live and redrawn throughout: the
 * close control, the backdrop, Escape and the system back gesture. `making`
 * guards `finish` against running twice, which is a guard on one symptom; this
 * is the mechanism, and it covers all five paths at once.
 *
 * **This is put at the choke point rather than at the callers**, the way
 * `repaint`'s own focus guard in `store.ts` sits at the choke point rather than
 * at everything that repaints. A second dismiss now finds the flag already gone
 * and closes the layer directly instead of traversing again.
 *
 * The `popstate` handler reads `getState()`, never this flag, so clearing it
 * early changes nothing about how the traversal is handled when it lands.
 *
 * Found by feature 027's holistic review at T048. The sidebar has the same
 * shape and shipped with it, which is the stronger argument for fixing the
 * mechanism here than for guarding one more caller.
 */
function disown(layer: "sidebar" | "wizard"): void {
  const current = (history.state ?? {}) as Record<string, unknown>;
  history.replaceState({ ...current, [layer]: false }, "");
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
  if (sidebarOwnsHistory()) {
    disown("sidebar");
    history.back();
  } else closeSidebar();
}

/**
 * The same three things for the setup wizard, and for the same reasons.
 *
 * Written out rather than folded into one pair of functions taking a name. Two
 * layers is not enough repetition to earn an abstraction over `history.state`,
 * and the flag on the entry is the thing the `popstate` handler reads, so a
 * generic version would only move the two names somewhere less obvious.
 */
export function rememberWizardOpen(): void {
  const current = asSurface((history.state as { surface?: unknown } | null)?.surface);
  history.pushState({ surface: current, wizard: true }, "");
}

/** Whether the entry on top of the stack is the wizard's own. */
export function wizardOwnsHistory(): boolean {
  return (history.state as { wizard?: unknown } | null)?.wizard === true;
}

/**
 * Closes the wizard, however it was asked for: escape, the backdrop, the close
 * control, or finishing. One path, so the entry pushed on opening is consumed
 * exactly once and the stack cannot deepen by a press per open.
 */
export function dismissWizard(): void {
  if (wizardOwnsHistory()) {
    disown("wizard");
    history.back();
  } else closeWizard();
}

/** Sends a system back gesture to the surface its history entry names. */
export function startSurfaceHistory(): void {
  window.addEventListener("popstate", (event: PopStateEvent) => {
    // The wizard goes before the drawer, and the drawer before the surface.
    // The rule is the same one 025 settled and it is about what the seller is
    // looking at: dismiss the topmost thing, never navigate underneath it.
    //
    // CHECKING THE WIZARD FIRST IS LOAD BEARING, not tidiness, and an earlier
    // version of this comment claimed the opposite: that both layers could
    // never be up at once, so the order was merely stated. That was wrong, and
    // the chunk 4 spec review found the path.
    //
    // `drawerOpen` in `shell.ts` is `state.sidebarOpen && !pinned`, and nothing
    // sets `sidebarOpen` back to false when the window grows wide enough to pin
    // the list. So: open the drawer on a narrow window, then widen it or rotate
    // the device. `sidebarOpen` is still true while `drawerOpen` is false,
    // which means `main` is not `inert`, which means the wizard's way in is
    // live. Both are then open as far as this handler can see.
    //
    // With the order reversed, that back press would consume the wizard's own
    // history entry to close a pinned sidebar nobody watched close, leaving the
    // wizard on screen and the next press leaving the app. The wizard is the
    // layer on top, by z-index and by the order the shell renders them, and
    // back dismisses what is on top.
    if (getState().wizardOpen) {
      closeWizard();
      return;
    }

    // The list of pages goes next, because it is what the seller is looking
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
