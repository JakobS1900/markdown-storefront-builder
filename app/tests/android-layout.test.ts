import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The one thing the page markup must not say inside the Android shell.
 *
 * Capacitor 8.5.0 decides how to handle window insets by looking at this page's
 * viewport meta tag. When it finds `viewport-fit=cover` and the device's WebView
 * is version 140 or newer, it takes a branch that pads the WebView's parent by
 * the keyboard's height:
 *
 *   v.setPadding(0, 0, 0, keyboardVisible ? imeInsets.bottom : 0);
 *
 * That branch exists for Android 15 and later, where the window is edge to edge
 * and is NOT resized when the keyboard opens. Unlike the branch directly below
 * it, it carries no `SDK_INT >= VANILLA_ICE_CREAM` guard, so it also runs on
 * older phones, where `adjust=resize` has already shrunk the window. The
 * keyboard is then subtracted twice.
 *
 * Measured on a Moto G7, Android 10, WebView 151, with the keyboard open:
 *
 *   parent FrameLayout  [0,110][1080,1361]   1251px, correct
 *   WebView             [0,110][1080,452]     342px, 909px short
 *
 * 909px is exactly the keyboard. The viewport collapsed from 672 to 114 CSS
 * pixels, leaving a sliver of the form above the tab bar and a dead band the
 * height of a second keyboard below it. Removing the attribute restored the
 * WebView to its parent's bounds and the viewport to 417 CSS pixels.
 *
 * Nothing is lost by dropping it. Without `viewport-fit=cover` the WebView's
 * viewport already excludes the system bars, so `env(safe-area-inset-*)` is
 * legitimately zero and the padding that uses it is a harmless no-op.
 *
 * This is a static check because the fault lives between the Android window and
 * the WebView, where jsdom cannot follow. What a test can hold onto is that the
 * attribute does not come back.
 */
const html = readFileSync("app/index.html", "utf8");

describe("the viewport meta tag", () => {
  it("exists and is mobile first", () => {
    expect(html).toMatch(/<meta name="viewport" content="[^"]*width=device-width/);
  });

  it("does not ask for viewport-fit=cover, which halves the usable screen on Android 14 and below", () => {
    const tag = /<meta name="viewport" content="([^"]*)"/.exec(html)?.[1] ?? "";
    expect(tag).not.toContain("viewport-fit");
  });
});
