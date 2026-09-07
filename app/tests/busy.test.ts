/**
 * @vitest-environment jsdom
 *
 * Saying that something is happening.
 *
 * This exists because opening a template looked broken. The starting points are
 * lazy chunks on purpose, kept out of the entry bundle by a test that fails if
 * they creep back in, so `starter.load()` is a dynamic import: about thirty
 * macrotask ticks cold, three warm. Between the tap and the page appearing
 * there was nothing on screen at all, and the only feedback was an
 * `announce()` after it had already finished, which a sighted seller never
 * hears.
 *
 * Jakob hit it on 2026-09-07, said the app was not loading the page, and then
 * noticed that it had. Something that works and looks broken for a second is a
 * defect.
 *
 * The tests below drive the store rather than the timing, because the timing is
 * the thing that varies. What has to hold is that the sentence is up BEFORE the
 * slow work finishes and gone afterwards, and that it never speaks over an
 * error.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { clearBusy, getState, init, setBusy, subscribe } from "../src/store.js";
import { renderShell } from "../src/ui/shell.js";

function shell(): HTMLElement {
  const host = document.createElement("div");
  host.id = "app";
  document.body.replaceChildren(host);
  renderShell(host);
  return host;
}

function statusText(host: HTMLElement): string {
  return host.querySelector(".status")?.textContent?.trim() ?? "";
}

describe("a slow thing says so", () => {
  beforeEach(() => {
    init(true);
  });

  it("shows the seller what is being opened, by name", () => {
    setBusy("Opening Handmade and crafts");
    expect(statusText(shell())).toBe("Opening Handmade and crafts");
  });

  it("puts it in a live region, so it is announced as well as shown", () => {
    setBusy("Opening Handmade and crafts");
    // `role="status"` is an implicit aria-live polite region. A sentence that
    // is only visible leaves out the seller who cannot see it, and this app has
    // an accessibility gate precisely so that does not keep happening.
    expect(shell().querySelector(".status")?.getAttribute("role")).toBe("status");
  });

  it("goes away when the work finishes", () => {
    setBusy("Opening Handmade and crafts");
    clearBusy();
    expect(statusText(shell())).toBe("");
  });

  it("repaints immediately rather than on the deferred repaint", () => {
    // The whole point is to be on screen BEFORE the slow thing finishes.
    // `setQuietly` defers by 200ms of quiet, which would put this up at roughly
    // the moment it stopped being true.
    //
    // Asserted by subscribing, because that is the mechanism: the store
    // notifies its listeners synchronously on the immediate path and on a timer
    // on the deferred one, and `main.ts` is what turns a notification into a
    // repaint. An earlier version of this test rendered a shell and expected it
    // to update itself, which tests the harness rather than the app: the shell
    // does not subscribe, so it only ever shows the state it was rendered with.
    let notified = 0;
    const stop = subscribe(() => {
      notified += 1;
    });

    setBusy("Opening the example page");
    expect(notified).toBe(1);
    expect(getState().status.message).toBe("Opening the example page");

    stop();
  });
});

describe("it never speaks over something that matters more", () => {
  it("does not replace an error", () => {
    // A browser that refuses storage puts an error up at init. A busy line on
    // top of it would hide the one message the seller has to read, and this app
    // has a rule that a failure keeps its own words.
    init(false);
    expect(getState().status.kind).toBe("error");

    setBusy("Opening something");
    expect(getState().status.kind).toBe("error");
  });

  it("does not clear a status it did not set", () => {
    // `clearBusy` runs after every one of these operations, including the ones
    // that failed and set their own message. It must take down its own sentence
    // and nothing else.
    init(false);
    clearBusy();
    expect(getState().status.kind).toBe("error");
  });
});
