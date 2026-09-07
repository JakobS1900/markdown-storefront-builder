/**
 * @vitest-environment jsdom
 *
 * The pages sidebar: its state, and what the back gesture does to it.
 *
 * Phase 1 of feature 025. This file covers the state and the history behaviour;
 * the panel itself and its focus handling arrive in phase 2 and are tested
 * here too when they do.
 *
 * The back gesture is asserted by dispatching `popstate` rather than by calling
 * `history.back()`. That is deliberate. jsdom's history is a model rather than a
 * browser, and the timing of a real back is not something a test here can
 * observe honestly. What this file can prove is what the handler does when the
 * event arrives, which is the part we wrote. The gesture itself is verified on
 * the handset, per T029, because that is the only place it is real.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  closeSidebar,
  getState,
  init,
  openSidebar,
  setSurface,
  subscribe,
} from "../src/store.js";
import {
  rememberSidebarOpen,
  sidebarOwnsHistory,
  startSurfaceHistory,
} from "../src/surface-history.js";

describe("the sidebar's open state", () => {
  beforeEach(() => {
    init(true);
  });

  it("starts closed, because the seller came here to look at a page", () => {
    expect(getState().sidebarOpen).toBe(false);
  });

  it("opens and closes", () => {
    openSidebar();
    expect(getState().sidebarOpen).toBe(true);

    closeSidebar();
    expect(getState().sidebarOpen).toBe(false);
  });

  it("repaints immediately, not on the deferred repaint", () => {
    // Same reasoning as `setBusy`. The deferred path waits 200ms of quiet, and
    // a panel that appears a fifth of a second after the tap reads as a tap
    // that needs repeating.
    let notified = 0;
    const stop = subscribe(() => {
      notified += 1;
    });

    openSidebar();
    expect(notified).toBe(1);

    closeSidebar();
    expect(notified).toBe(2);

    stop();
  });

  it("closing an already closed sidebar changes nothing", () => {
    let notified = 0;
    const stop = subscribe(() => {
      notified += 1;
    });

    closeSidebar();
    expect(notified).toBe(0);

    stop();
  });
});

describe("the system back gesture", () => {
  beforeEach(() => {
    init(true);
    startSurfaceHistory();
  });

  it("closes the sidebar rather than changing surface", () => {
    // The whole point. Back with a drawer open should dismiss the drawer, which
    // is what the seller is looking at, not navigate underneath it.
    setSurface("export");
    openSidebar();

    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));

    expect(getState().sidebarOpen).toBe(false);
    expect(getState().surface).toBe("export");
  });

  it("gives back something to consume when the drawer opens", () => {
    // Without an entry of its own, back on Build leaves the app before any
    // popstate fires, because Build deliberately pushes nothing. The drawer
    // would be dismissed by closing the app, which is not dismissing it.
    rememberSidebarOpen();
    expect(sidebarOwnsHistory()).toBe(true);
  });

  it("carries the current surface on that entry", () => {
    // `rememberSurface` reads the surface off history.state to decide whether
    // to push, replace or go back. An entry without one would make it treat the
    // seller as being on the first screen while the drawer is open.
    setSurface("export");
    history.replaceState({ surface: "export" }, "");

    rememberSidebarOpen();
    expect((history.state as { surface?: string }).surface).toBe("export");
  });

  it("still returns to Build when the sidebar is not open", () => {
    // The behaviour that already existed, and that this must not break. Back
    // from Preview or Copy returns to Build; back from Build leaves the app,
    // which is why Build pushes no entry.
    setSurface("preview");

    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));

    expect(getState().surface).toBe("build");
  });
});
