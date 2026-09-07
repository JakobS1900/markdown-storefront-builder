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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { resetSidebarFocusTracking } from "../src/ui/pages-sidebar.js";
import { renderShell } from "../src/ui/shell.js";

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

/**
 * The panel, in both of its containers.
 *
 * jsdom lays nothing out and answers no media query by default, so `matchMedia`
 * is stubbed to say which side of the breakpoint we are on. That is honest for
 * what these assert, which is what gets BUILT at each width. Whether it then
 * looks right is measured in a browser, not here.
 */
function atWidth(pinned: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("1300") ? pinned : true,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function shell(): HTMLElement {
  const host = document.createElement("div");
  host.id = "app";
  document.body.replaceChildren(host);
  renderShell(host);
  return host;
}

describe("where the list is drawn", () => {
  beforeEach(() => {
    init(true);
    resetSidebarFocusTracking();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is absent entirely when the drawer is closed", () => {
    // Not hidden. Absent. A closed drawer that is still built costs a rebuild
    // on every keystroke, and a rebuild measured 37ms on the handset this
    // project is measured against.
    atWidth(false);
    const host = shell();
    expect(host.querySelector(".pages-drawer")).toBeNull();
    expect(host.querySelector(".pages-panel")).toBeNull();
  });

  it("is a drawer when the window is narrow and it has been opened", () => {
    atWidth(false);
    openSidebar();
    const host = shell();
    expect(host.querySelector(".pages-drawer .pages-panel")).not.toBeNull();
  });

  it("is a pinned column when there is room, without being opened", () => {
    // FR-097. Nothing to open: it is simply there.
    atWidth(true);
    const host = shell();
    expect(host.querySelector(".pages-panel.pinned")).not.toBeNull();
    expect(host.querySelector(".pages-drawer")).toBeNull();
  });

  it("offers no trigger where the list is already pinned", () => {
    atWidth(true);
    const host = shell();
    expect(host.querySelector('.bar [aria-controls="pages-panel"]')).toBeNull();
  });

  it("offers the trigger in the header on every surface", () => {
    // FR-093: one control, one place. The header is the only thing on screen
    // for all three surfaces.
    atWidth(false);
    for (const surface of ["build", "preview", "export"] as const) {
      setSurface(surface);
      const host = shell();
      expect(host.querySelector('.bar [aria-controls="pages-panel"]')).not.toBeNull();
    }
  });
});

describe("what the drawer does to everything behind it", () => {
  beforeEach(() => {
    init(true);
    resetSidebarFocusTracking();
    atWidth(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks the rest of the app inert while it is open", () => {
    // The attribute is what a browser acts on. jsdom implements `inert`
    // neither as a property nor as behaviour, proven by probe, so this asserts
    // only that the word is applied. The guarantee that is actually TESTED is
    // the focus containment below, which is why both exist.
    openSidebar();
    const host = shell();
    for (const selector of ["header.bar", "main", "nav.tabs"]) {
      expect([selector, host.querySelector(selector)?.hasAttribute("inert")]).toEqual([
        selector,
        true,
      ]);
    }
  });

  it("leaves nothing inert once it closes", () => {
    openSidebar();
    shell();
    closeSidebar();
    const host = shell();
    for (const selector of ["header.bar", "main", "nav.tabs"]) {
      expect([selector, host.querySelector(selector)?.hasAttribute("inert")]).toEqual([
        selector,
        false,
      ]);
    }
  });

  it("never transforms the app root", () => {
    // This is a real bug that shipped. A transform on `#app` makes it the
    // containing block for every fixed descendant, so `.tabs` pinned itself to
    // the app rather than the viewport. The drawer slides the PANEL, and this
    // asserts the rule rather than trusting a comment to enforce it, because
    // the next thing added to `#app` can reintroduce it.
    openSidebar();
    const host = shell();
    expect(host.style.transform).toBe("");
    expect(host.getAttribute("style") ?? "").not.toContain("transform");
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
