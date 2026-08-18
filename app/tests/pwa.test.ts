import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The PWA contract.
 *
 * These are static checks on the manifest, the icons, and the service worker
 * source. Actually installing and going offline needs a real browser, and that
 * was verified by hand: the server was stopped, the page reloaded from cache,
 * and a section was added with no network. What a test can hold onto is that
 * the pieces which make that possible do not quietly rot.
 */

const manifest = JSON.parse(readFileSync("app/public/manifest.webmanifest", "utf8")) as {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
};

const sw = readFileSync("app/public/sw.js", "utf8");
const html = readFileSync("app/index.html", "utf8");

describe("the manifest makes the app installable", () => {
  it("has the fields a browser requires before offering installation", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe("standalone");
  });

  it("ships an icon at both sizes browsers ask for", () => {
    const sizes = manifest.icons.filter((i) => i.purpose === "any").map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("ships a maskable icon, so launchers do not crop the artwork", () => {
    const maskable = manifest.icons.find((i) => i.purpose === "maskable");
    expect(maskable).toBeDefined();
    expect(maskable?.sizes).toBe("512x512");
  });

  it("points at icons that actually exist and are real PNGs", () => {
    for (const icon of manifest.icons) {
      const bytes = readFileSync(`app/public/${icon.src.replace("./", "")}`);
      expect(bytes.length).toBeGreaterThan(200);
      // PNG magic number. A broken generator would otherwise ship a valid-
      // looking file that no launcher can draw.
      expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    }
  });

  it("uses relative paths, so it works from a subdirectory", () => {
    // The app may be hosted at /something/ rather than at a domain root.
    expect(manifest.start_url.startsWith("./")).toBe(true);
    expect(manifest.scope.startsWith("./")).toBe(true);
    for (const icon of manifest.icons) expect(icon.src.startsWith("./")).toBe(true);
  });

  it("matches the theme colour the page declares", () => {
    expect(html).toContain(`content="${manifest.theme_color}"`);
  });
});

describe("the page links the manifest and the icons", () => {
  it.each([
    ['rel="manifest"', "manifest"],
    ['rel="icon"', "favicon"],
    ['rel="apple-touch-icon"', "iOS home screen icon"],
    ['name="theme-color"', "theme colour"],
  ])("declares %s for the %s", (needle) => {
    expect(html).toContain(needle);
  });
});

describe("the service worker cannot go stale silently", () => {
  it("carries a build id placeholder for the build to stamp", () => {
    // If this is ever hardcoded, every deploy after it serves the old shell to
    // returning visitors and nobody finds out for weeks.
    expect(sw).toContain("__BUILD_ID__");
  });

  it("names its cache after that id", () => {
    expect(sw).toMatch(/shell-\$\{VERSION\}/);
  });

  it("deletes caches from previous versions on activate", () => {
    expect(sw).toContain("caches.delete");
  });

  it("takes over immediately rather than waiting for every tab to close", () => {
    expect(sw).toContain("skipWaiting");
    expect(sw).toContain("clients.claim");
  });
});

describe("the service worker only handles what is ours", () => {
  it("ignores anything that is not a GET", () => {
    expect(sw).toContain('request.method !== "GET"');
  });

  it("ignores other origins, so an artist's linked image is never cached", () => {
    // Caching someone else's picture without being asked is not ours to do,
    // and it would also mean an image that changed upstream never updates.
    expect(sw).toContain("self.location.origin");
  });

  it("falls back to the shell for a navigation when offline and uncached", () => {
    expect(sw).toContain('request.mode === "navigate"');
  });
});
