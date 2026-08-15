import { describe, expect, it } from "vitest";

import { emitLink, isSafeUrl } from "../../src/compile/link.js";

/**
 * Links. FR-004, FR-005, SC-003.
 *
 * Links are the first place artist input becomes something a third party
 * interacts with rather than merely reads. A client clicking a link on a
 * commission page is trusting the artist, and the artist is trusting us.
 */

describe("isSafeUrl: only http and https are links", () => {
  it.each([
    "http://example.test",
    "https://example.test",
    "https://example.test/path?q=1#frag",
    "HTTPS://EXAMPLE.TEST",
  ])("accepts %j", (url) => {
    expect(isSafeUrl(url)).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "java\tscript:alert(1)",
    "  javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "about:blank",
    "mailto:someone@example.test",
    "//protocol-relative.test",
    "",
    "   ",
    "not a url at all",
  ])("rejects %j", (url) => {
    expect(isSafeUrl(url)).toBe(false);
  });
});

describe("emitLink: an address cannot end its link early (FR-005)", () => {
  it("emits an ordinary link", () => {
    expect(emitLink("Bluesky", "https://example.test/ari")).toBe(
      "[Bluesky](https://example.test/ari)",
    );
  });

  it("escapes a closing parenthesis in the address", () => {
    const out = emitLink("wiki", "https://example.test/a_(b)");
    expect(out).toBe("[wiki](https://example.test/a_%28b%29)");
  });

  it("escapes characters that would break out of the address", () => {
    for (const nasty of ["https://e.test/a)b", "https://e.test/a b", "https://e.test/a\nb"]) {
      const out = emitLink("x", nasty);
      // Everything after the opening paren and before the final one must be
      // free of anything that could terminate it early.
      const inner = out.slice(out.indexOf("](") + 2, -1);
      expect(inner).not.toContain(")");
      expect(inner).not.toMatch(/\s/);
    }
  });

  it("escapes the label as ordinary artist text", () => {
    const out = emitLink("a [bracket] and **stars**", "https://example.test");
    expect(out).toContain("\\[bracket\\]");
    expect(out).toContain("\\*\\*stars\\*\\*");
  });

  it("never emits an angle bracket", () => {
    const out = emitLink("<b>label</b>", "https://example.test/<x>");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
  });
});
