/**
 * @vitest-environment jsdom
 *
 * Back should go back, not out.
 *
 * On the phone, pressing back left the app from every screen:
 *
 *   back from Preview  -> LEFT the app
 *   back from Copy     -> LEFT the app
 *   back from Build    -> LEFT the app
 *
 * From Build that is right. From the other two it throws away the app when the
 * person meant "return to Build". Capacitor does not intercept back at all, so
 * the activity simply finished.
 *
 * Moving between surfaces now leaves a history entry, so the WebView has
 * somewhere to go back to, and the native shell sends back there first. Build
 * itself pushes nothing, so back from Build still leaves, which is what a
 * person expects from the first screen of an app.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { getState, init, setSurface } from "../src/store.js";
import { rememberSurface, startSurfaceHistory } from "../src/surface-history.js";

beforeEach(() => {
  init(false);
  history.replaceState(null, "", "#");
});

describe("moving between surfaces", () => {
  it("leaves a history entry when going somewhere other than Build", () => {
    const before = history.length;
    rememberSurface("preview");
    expect(history.length).toBeGreaterThan(before);
    expect((history.state as { surface?: string } | null)?.surface).toBe("preview");
  });

  it("does not stack an entry for Build, so back from the first screen leaves the app", () => {
    rememberSurface("build");
    expect(history.state).toBeNull();
  });

  it("does not stack a second entry for the surface already showing", () => {
    rememberSurface("preview");
    const after = history.length;
    rememberSurface("preview");
    expect(history.length).toBe(after);
  });
});

describe("when the system goes back", () => {
  it("returns to Build rather than closing", () => {
    startSurfaceHistory();
    setSurface("preview");
    expect(getState().surface).toBe("preview");

    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));

    expect(getState().surface).toBe("build");
  });

  it("returns to whichever surface the entry names", () => {
    startSurfaceHistory();
    setSurface("export");

    window.dispatchEvent(new PopStateEvent("popstate", { state: { surface: "preview" } }));

    expect(getState().surface).toBe("preview");
  });

  it("ignores an entry naming something that is not a surface", () => {
    startSurfaceHistory();
    setSurface("preview");

    window.dispatchEvent(new PopStateEvent("popstate", { state: { surface: "nonsense" } }));

    expect(getState().surface).toBe("build");
  });
});
