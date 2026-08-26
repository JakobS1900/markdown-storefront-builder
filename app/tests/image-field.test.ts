/**
 * @vitest-environment jsdom
 *
 * The image field has to describe the controls it actually rendered.
 *
 * This exists because it did not. The hint was a single unconditional string
 * beginning "Upload a picture, or paste the address", while the upload button
 * is only built when a Client-ID was set at build time. The public deploy
 * ships without one on purpose, so the build most artists would ever see was
 * the one telling them to press a control that was not on the page.
 *
 * That bug was invisible to every other test, because they all run with a
 * Client-ID pinned in vitest.config.ts. Here the module is mocked instead, so
 * both builds are exercised in one run and neither can drift unwatched.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ configured: false }));

vi.mock("../src/upload.js", () => ({
  uploadConfigured: () => mocks.configured,
  uploadImage: vi.fn(),
}));

const { imageField } = await import("../src/ui/image-field.js");

function render(): HTMLElement {
  document.body.innerHTML = '<div id="live-region" class="sr-only"></div>';
  const node = imageField({ label: "Profile picture", value: "", onInput: () => {} });
  document.body.append(node);
  return node;
}

function hint(node: HTMLElement): string {
  return node.querySelector(".hint")?.textContent ?? "";
}

describe("the image field without an upload key", () => {
  beforeEach(() => {
    mocks.configured = false;
  });

  it("renders no upload control at all", () => {
    const node = render();
    expect(node.querySelector("input[type=file]")).toBeNull();
    expect(node.querySelector(".uploader")).toBeNull();
  });

  it("never tells the artist to press a button that is not there", () => {
    const text = hint(render());
    // The specific wording that shipped and was wrong.
    expect(text).not.toMatch(/^Upload a picture/);
    expect(text.toLowerCase()).not.toContain("upload it from this device");
  });

  it("says how to get an address instead, since that is the only path left", () => {
    const text = hint(render());
    expect(text).toContain("imgur.com");
    // Naming a site an artist must visit is useless if they think it needs a
    // login, which is the reason most of them pay somebody else to do this.
    expect(text).toContain("no account");
  });

  it("still warns that the page only links to the image", () => {
    expect(hint(render())).toContain("stops showing");
  });
});

describe("the image field with an upload key", () => {
  beforeEach(() => {
    mocks.configured = true;
  });

  it("renders the upload control", () => {
    const node = render();
    expect(node.querySelector("input[type=file]")).not.toBeNull();
    const names = [...node.querySelectorAll("button")].map((b) => b.textContent);
    expect(names).toContain("Upload a picture from this device");
  });

  it("offers the upload in the hint, because now there is one to offer", () => {
    expect(hint(render())).toMatch(/^Upload a picture/);
  });

  it("still warns that the page only links to the image", () => {
    expect(hint(render())).toContain("stops showing");
  });
});
