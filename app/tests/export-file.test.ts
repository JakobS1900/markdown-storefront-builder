/**
 * @vitest-environment jsdom
 *
 * The .md download, and the host it is not for. FR-035.
 *
 * A file is not a host. The box on the Export tab is tuned for the one site
 * the seller picked; a file goes to GitHub, to Obsidian, to a text editor, or
 * to a different paste site next year. This button used to hand over the
 * host-specific output.
 *
 * There was no test over the export surface at all, which is how the button
 * shipped that way in the first place.
 *
 * WHAT THESE CANNOT PROVE, stated because the first version of this file
 * pretended otherwise. Since FR-036 moved the portable baseline to trailing
 * spaces, all three shipped hosts compile to byte identical output. So
 * "the file equals the portable output" passes whichever target the button
 * picks, and it cannot fail today. It is kept because it becomes load bearing
 * the moment any host diverges again, which has already happened twice.
 *
 * The test below that does bite regardless is the last one: it asserts the
 * property the change actually exists to guarantee, rather than the identity
 * of the target used to reach it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PORTABLE, RENTRY, TARGETS, TEXT_IS, compile } from "@mdsb/engine";

import { addBlock, getState, init, updateBlock } from "../src/store.js";
import { blankBlock } from "../src/ui/forms.js";
import { exportSurface } from "../src/ui/export.js";
import * as files from "../src/files.js";

/** Captures what the download button actually hands over. */
function handedOff(): { name: string; text: string } {
  const spy = vi.spyOn(files, "handOff").mockReturnValue({ ok: true, message: "Saved." });
  const container = document.getElementById("surface");
  if (container === null) throw new Error("no container");
  exportSurface(container);

  const button = [...container.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").trim() === "Save as a .md file",
  );
  if (button === undefined) {
    throw new Error(
      "no .md button, saw: " +
        [...container.querySelectorAll("button")].map((b) => b.textContent).join(" | "),
    );
  }
  button.click();

  const call = spy.mock.calls[0];
  if (call === undefined) throw new Error("nothing was handed off");
  spy.mockRestore();
  return { name: String(call[0]), text: String(call[1]) };
}

/** A page whose prose contains a hard break, which is where hosts diverge. */
function pageWithBreak(targetId: string): void {
  document.body.innerHTML =
    '<div id="surface"></div><div id="live-region" class="sr-only" role="status" aria-live="polite"></div>';
  init(false);
  addBlock(blankBlock("prose"));
  const block = getState().doc.blocks[0];
  if (block === undefined || block.kind !== "prose") throw new Error("not prose");
  updateBlock(block.id, { ...block, text: "Half up front.\nRefunds before lining starts." });
  (getState().doc as { target: string }).target = targetId;
}

describe("the file the button hands over", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("is named page.md", () => {
    pageWithBreak(RENTRY.id);
    expect(handedOff().name).toBe("page.md");
  });

  it("matches the portable output, whichever host is selected", () => {
    // Cannot fail while every host agrees. See the note at the top.
    for (const target of TARGETS) {
      pageWithBreak(target.id);
      const doc = getState().doc;
      expect(handedOff().text, `selected ${target.id}`).toBe(compile(doc, PORTABLE).markdown);
    }
  });

  it("actually reflects the target that was set, so the setup is not inert", () => {
    // Guards the helper rather than the feature. If assigning the target
    // silently did nothing, every test above would pass for the wrong reason.
    pageWithBreak(TEXT_IS.id);
    expect(getState().doc.target).toBe(TEXT_IS.id);
  });
});

describe("the property the change exists to guarantee", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("never ends a line with the backslash that text.is destroys", () => {
    // This one bites. Before FR-036 the portable baseline emitted exactly the
    // form that joins two sentences into one word on text.is, so compiling the
    // file portable, which is what the button now does, would have produced a
    // file that breaks on the host the same release added.
    for (const target of TARGETS) {
      pageWithBreak(target.id);
      const lines = handedOff().text.split("\n");
      expect(lines.filter((l) => l.endsWith("\\")), `selected ${target.id}`).toEqual([]);
    }
  });

  it("keeps the two sentences apart", () => {
    pageWithBreak(RENTRY.id);
    const text = handedOff().text;
    expect(text).toContain("Half up front.  \nRefunds before lining starts.");
    expect(text).not.toContain("front.Refunds");
  });
});
