import { describe, expect, it } from "vitest";

import {
  DEFAULT_LIMITS,
  RateLimiter,
  createUploadHandler,
  sniffImageType,
  type Env,
  type Upstream,
} from "../src/upload.js";

/**
 * The upload proxy.
 *
 * Every one of these is a control rather than a nicety, so each test names the
 * thing that goes wrong without it. The proxy is the only server in the product
 * and the only place a key exists, which makes it the only place where a mistake
 * costs money or leaks something.
 */

const ORIGIN = "https://app.test";
const env: Env = {
  UPLOAD_KEY: "test-key-never-real",
  UPLOAD_ENDPOINT: "https://images.test/upload",
  ALLOWED_ORIGINS: ORIGIN,
};

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

const ok: Upstream = async () => ({ ok: true, url: "https://images.test/abc.png" });
const broken: Upstream = async () => ({ ok: false, reason: "upstream said no, key=test-key-never-real" });

function post(body: Uint8Array, headers: Record<string, string> = {}): Request {
  return new Request("https://proxy.test/upload", {
    method: "POST",
    // The buffer rather than the view: a Uint8Array is not a BodyInit under
    // these lib settings, and slicing keeps the exact bytes under test.
    body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
    headers: { origin: ORIGIN, "cf-connecting-ip": "203.0.113.1", ...headers },
  });
}

describe("the file type comes from the bytes, never the declaration", () => {
  it.each([
    ["PNG", PNG, "image/png"],
    ["JPEG", JPEG, "image/jpeg"],
    ["GIF", GIF, "image/gif"],
    ["WebP", WEBP, "image/webp"],
  ])("identifies %s", (_label, bytes, mime) => {
    expect(sniffImageType(bytes)).toBe(mime);
  });

  it("refuses an SVG, which is a document that can carry script", () => {
    const svg = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
    expect(sniffImageType(svg)).toBeUndefined();
  });

  it("refuses HTML dressed up with an image content type", () => {
    const html = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
    expect(sniffImageType(html)).toBeUndefined();
  });

  it("refuses a file too short to identify, rather than guessing", () => {
    expect(sniffImageType(new Uint8Array([0x89, 0x50]))).toBeUndefined();
  });

  it("ignores a lying Content-Type header end to end", async () => {
    const handle = createUploadHandler({ upstream: ok });
    const html = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
    const res = await handle(post(html, { "content-type": "image/png" }), env);
    expect(res.status).toBe(415);
  });
});

describe("size is enforced twice, because a header can lie", () => {
  it("refuses on the declared length before reading the body", async () => {
    const handle = createUploadHandler({ upstream: ok });
    const res = await handle(
      post(PNG, { "content-length": String(DEFAULT_LIMITS.maxBytes + 1) }),
      env,
    );
    expect(res.status).toBe(413);
  });

  it("refuses on the real length even when the header understates it", async () => {
    const handle = createUploadHandler({
      upstream: ok,
      limits: { ...DEFAULT_LIMITS, maxBytes: 16 },
    });
    const big = new Uint8Array(64);
    big.set(PNG.subarray(0, 8));
    const res = await handle(post(big, { "content-length": "1" }), env);
    expect(res.status).toBe(413);
  });

  it("refuses an empty file", async () => {
    const handle = createUploadHandler({ upstream: ok });
    expect((await handle(post(new Uint8Array(0)), env)).status).toBe(400);
  });
});

describe("the rate limit stops an endpoint becoming someone else's bill", () => {
  it("allows up to the limit then refuses", () => {
    const limiter = new RateLimiter({ windowMs: 1000, maxPerWindow: 3, maxBytes: 1 });
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 1)).toBe(true);
    expect(limiter.allow("a", 2)).toBe(true);
    expect(limiter.allow("a", 3)).toBe(false);
  });

  it("forgets attempts once the window has passed", () => {
    const limiter = new RateLimiter({ windowMs: 1000, maxPerWindow: 1, maxBytes: 1 });
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 500)).toBe(false);
    expect(limiter.allow("a", 1500)).toBe(true);
  });

  it("counts each caller separately", () => {
    const limiter = new RateLimiter({ windowMs: 1000, maxPerWindow: 1, maxBytes: 1 });
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("b", 0)).toBe(true);
    expect(limiter.allow("a", 0)).toBe(false);
  });

  it("returns 429 over the limit, through the handler", async () => {
    const limiter = new RateLimiter({ ...DEFAULT_LIMITS, maxPerWindow: 1 });
    const handle = createUploadHandler({ upstream: ok, limiter, now: () => 0 });
    expect((await handle(post(PNG), env)).status).toBe(200);
    expect((await handle(post(PNG), env)).status).toBe(429);
  });

  it("takes identity from the connection, not from anything the body says", async () => {
    const limiter = new RateLimiter({ ...DEFAULT_LIMITS, maxPerWindow: 1 });
    const handle = createUploadHandler({ upstream: ok, limiter, now: () => 0 });

    await handle(post(PNG, { "cf-connecting-ip": "198.51.100.1" }), env);
    // A different connection is a different bucket, and no header in the body
    // could have changed that.
    expect((await handle(post(PNG, { "cf-connecting-ip": "198.51.100.2" }), env)).status).toBe(200);
  });
});

describe("the key never reaches a client", () => {
  it("refuses to run at all when unconfigured, rather than half working", async () => {
    const handle = createUploadHandler({ upstream: ok });
    const res = await handle(post(PNG), { ALLOWED_ORIGINS: ORIGIN });
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain("KEY");
  });

  it("does not forward an upstream failure reason, which may name the key", async () => {
    const handle = createUploadHandler({ upstream: broken });
    const res = await handle(post(PNG), env);
    const body = await res.text();

    expect(res.status).toBe(502);
    expect(body).not.toContain("test-key-never-real");
    expect(body).not.toContain("images.test");
  });

  it("never mentions the key in any response, across every failure path", async () => {
    const handle = createUploadHandler({ upstream: broken });
    const requests = [
      post(new Uint8Array(0)),
      post(new TextEncoder().encode("not an image")),
      post(PNG, { "content-length": String(DEFAULT_LIMITS.maxBytes + 1) }),
      new Request("https://proxy.test/upload", { method: "GET", headers: { origin: ORIGIN } }),
      post(PNG),
    ];

    for (const request of requests) {
      const body = await (await handle(request, env)).text();
      expect(body).not.toContain(env.UPLOAD_KEY);
      expect(body).not.toContain("UPLOAD_KEY");
    }
  });
});

describe("only configured origins are answered", () => {
  it("echoes an allowed origin", async () => {
    const handle = createUploadHandler({ upstream: ok });
    const res = await handle(post(PNG), env);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  });

  it("does not grant access to an origin that is not configured", async () => {
    const handle = createUploadHandler({ upstream: ok });
    const res = await handle(post(PNG, { origin: "https://evil.test" }), env);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("never answers with a wildcard", async () => {
    const handle = createUploadHandler({ upstream: ok });
    for (const origin of [ORIGIN, "https://evil.test"]) {
      const res = await handle(post(PNG, { origin }), env);
      expect(res.headers.get("access-control-allow-origin")).not.toBe("*");
    }
  });

  it("answers a preflight so the browser will make the real request", async () => {
    const handle = createUploadHandler({ upstream: ok });
    const res = await handle(
      new Request("https://proxy.test/upload", { method: "OPTIONS", headers: { origin: ORIGIN } }),
      env,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });
});

describe("the happy path", () => {
  it("returns the address the image host gave back", async () => {
    const handle = createUploadHandler({ upstream: ok });
    const res = await handle(post(PNG), env);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { url: string }).url).toBe("https://images.test/abc.png");
  });

  it("passes the sniffed type upstream, not the declared one", async () => {
    let seen = "";
    const handle = createUploadHandler({
      upstream: async (_b, mime) => {
        seen = mime;
        return { ok: true, url: "https://images.test/x.jpg" };
      },
    });
    await handle(post(JPEG, { "content-type": "image/png" }), env);
    expect(seen).toBe("image/jpeg");
  });

  it("refuses anything that is not a POST", async () => {
    const handle = createUploadHandler({ upstream: ok });
    for (const method of ["GET", "PUT", "DELETE", "HEAD"]) {
      const res = await handle(
        new Request("https://proxy.test/upload", { method, headers: { origin: ORIGIN } }),
        env,
      );
      expect(res.status).toBe(405);
    }
  });
});
