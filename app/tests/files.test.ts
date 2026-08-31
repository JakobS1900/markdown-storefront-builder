/**
 * @vitest-environment jsdom
 *
 * Handing a file to the person using the app.
 *
 * In a browser an anchor with a `download` attribute is the whole story. Inside
 * the Android shell it is inert: the WebView ignores a `blob:` link unless the
 * native side handles it, and nothing does. Verified on a Moto G7 by pressing
 * both export buttons and then searching the entire device, shared storage and
 * the app sandbox alike, for the files they claimed to write. There were none,
 * and the app had already announced "Downloaded a backup".
 *
 * That is the part that made it worth fixing rather than removing: the backup
 * button is the escape hatch for someone's only copy of their page, and it was
 * saying it had worked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handOff } from "../src/files.js";

interface Saved {
  name: string;
  mime: string;
  text: string;
}

let clicked: { href: string; download: string }[] = [];

beforeEach(() => {
  clicked = [];
  delete (window as unknown as { AndroidFiles?: unknown }).AndroidFiles;
  // Record what a browser download would have done.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({
      href: this.getAttribute("href") ?? "",
      download: this.getAttribute("download") ?? "",
    });
  });
  if (typeof URL.createObjectURL !== "function") {
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => "blob:fake";
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;
  }
});

describe("in a browser", () => {
  it("downloads through an anchor, as before", () => {
    const result = handOff("page.md", "# hi", "text/markdown");
    expect(result.ok).toBe(true);
    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.download).toBe("page.md");
  });
});

describe("inside the Android shell", () => {
  function installBridge(reply: string): Saved[] {
    const seen: Saved[] = [];
    (window as unknown as { AndroidFiles: unknown }).AndroidFiles = {
      save(name: string, mime: string, text: string): string {
        seen.push({ name, mime, text });
        return reply;
      },
    };
    return seen;
  }

  it("hands the file to the native side instead of clicking a dead link", () => {
    const seen = installBridge("ok");
    const result = handOff("page.md", "# hi", "text/markdown");

    expect(result.ok).toBe(true);
    expect(seen).toEqual([{ name: "page.md", mime: "text/markdown", text: "# hi" }]);
    expect(clicked, "it still clicked the anchor the WebView ignores").toHaveLength(0);
  });

  it("reports failure rather than claiming a file was written", () => {
    installBridge("error: could not create the folder");
    const result = handOff("page-backup.json", "{}", "application/json");

    expect(result.ok).toBe(false);
    expect(result.message).toContain("could not");
  });

  it("treats a bridge that throws as a failure, not a success", () => {
    (window as unknown as { AndroidFiles: unknown }).AndroidFiles = {
      save(): string {
        throw new Error("binder died");
      },
    };
    const result = handOff("page.md", "# hi", "text/markdown");
    expect(result.ok).toBe(false);
  });
});
