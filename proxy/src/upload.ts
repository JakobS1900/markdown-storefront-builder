/**
 * The image upload proxy.
 *
 * Roadmap 3.2. The only server this product has, and it exists for one reason:
 * the key that talks to the image host must never reach the browser. That is
 * item one on the list of things this project's author reviews other people's
 * apps for, so shipping it any other way was never an option.
 *
 * It is written as a plain `fetch` handler over the Web platform's Request and
 * Response, so it runs on Cloudflare Workers, Deno Deploy, Vercel Edge, or a
 * local Node server with no changes. That also means its logic is testable
 * without deploying anything, which is the only way it could be verified here.
 *
 * The discipline, stated plainly because it is the whole point:
 *
 *   - Everything the client validated is re-validated. Client-side checks are a
 *     courtesy to the user, never a control.
 *   - The file type comes from the bytes, not from the declared Content-Type,
 *     because the declaration is written by whoever is calling.
 *   - There is a byte ceiling and a per-address rate limit, because an
 *     unmetered upload endpoint is someone else's bill.
 *   - The upstream key is read from the environment and never appears in a
 *     response, not even in an error.
 */

export interface Env {
  /** The image host's key. Server side only, never sent to a client. */
  readonly UPLOAD_KEY?: string;
  /** Where the upload is forwarded. Configurable so the host can be swapped. */
  readonly UPLOAD_ENDPOINT?: string;
  /** Origins allowed to call this. Comma separated. */
  readonly ALLOWED_ORIGINS?: string;
}

export interface Limits {
  readonly maxBytes: number;
  readonly windowMs: number;
  readonly maxPerWindow: number;
}

export const DEFAULT_LIMITS: Limits = {
  // Four megabytes. Large enough for a full-resolution illustration after the
  // client has downscaled it, small enough that a hundred of them is not a
  // surprise invoice.
  maxBytes: 4 * 1024 * 1024,
  windowMs: 60_000,
  maxPerWindow: 10,
};

/**
 * File types accepted, identified by their leading bytes.
 *
 * SVG is deliberately absent. An SVG is a document that can carry script, so
 * accepting one would mean hosting executable content on the artist's behalf.
 * The formats here are all inert raster images.
 */
const SIGNATURES: readonly { readonly mime: string; readonly magic: readonly number[]; readonly offset?: number }[] = [
  { mime: "image/png", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  { mime: "image/gif", magic: [0x47, 0x49, 0x46, 0x38] },
  // RIFF....WEBP: the format tag sits at offset 8, after the size field.
  { mime: "image/webp", magic: [0x57, 0x45, 0x42, 0x50], offset: 8 },
];

/**
 * Identifies a file from its bytes, or returns undefined.
 *
 * The declared Content-Type is ignored entirely. It is supplied by the caller,
 * so trusting it would mean letting the caller decide what they are allowed to
 * upload.
 */
export function sniffImageType(bytes: Uint8Array): string | undefined {
  for (const { mime, magic, offset = 0 } of SIGNATURES) {
    if (bytes.length < offset + magic.length) continue;
    if (magic.every((b, i) => bytes[offset + i] === b)) return mime;
  }
  return undefined;
}

/** A fixed-window rate limiter, keyed by whatever the caller considers an identity. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly limits: Limits) {}

  /** Records an attempt. Returns false when the caller is over the limit. */
  allow(key: string, now: number): boolean {
    const cutoff = now - this.limits.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);

    if (recent.length >= this.limits.maxPerWindow) {
      // Keep the pruned list so memory does not grow without bound while a
      // caller is being refused.
      this.hits.set(key, recent);
      return false;
    }

    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

function json(status: number, body: Record<string, unknown>, origin?: string): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (origin !== undefined) {
    headers["access-control-allow-origin"] = origin;
    headers["vary"] = "origin";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

/** Which origins may call this, from configuration rather than a wildcard. */
function allowedOrigin(request: Request, env: Env): string | undefined {
  const origin = request.headers.get("origin");
  if (origin === null) return undefined;
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : undefined;
}

/**
 * Forwards the bytes to the image host.
 *
 * Injected so the handler can be tested without a real upstream, and so the
 * host can be replaced without touching any of the logic above it.
 */
export type Upstream = (
  bytes: Uint8Array,
  mime: string,
  env: Env,
) => Promise<{ readonly ok: true; readonly url: string } | { readonly ok: false; readonly reason: string }>;

export interface HandlerOptions {
  readonly limits?: Limits;
  readonly upstream: Upstream;
  /** Injected so tests are not at the mercy of the clock. */
  readonly now?: () => number;
  readonly limiter?: RateLimiter;
}

/**
 * Builds the request handler.
 *
 * Every failure returns a message the app can show an artist. None of them
 * include anything about the upstream, the key, or the internals: an error
 * message is a response to an untrusted caller, not a log line.
 */
export function createUploadHandler(options: HandlerOptions) {
  const limits = options.limits ?? DEFAULT_LIMITS;
  const limiter = options.limiter ?? new RateLimiter(limits);
  const now = options.now ?? (() => Date.now());

  return async function handle(request: Request, env: Env): Promise<Response> {
    const origin = allowedOrigin(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers:
          origin === undefined
            ? {}
            : {
                "access-control-allow-origin": origin,
                "access-control-allow-methods": "POST, OPTIONS",
                "access-control-allow-headers": "content-type",
                "access-control-max-age": "86400",
                vary: "origin",
              },
      });
    }

    if (request.method !== "POST") {
      return json(405, { error: "This address only accepts uploads." }, origin);
    }

    // An unconfigured deployment refuses rather than half working. A missing key
    // is an operator mistake, and pretending otherwise would produce uploads
    // that silently go nowhere.
    if (env.UPLOAD_KEY === undefined || env.UPLOAD_KEY === "") {
      return json(503, { error: "Uploads are not set up on this server yet." }, origin);
    }

    // The client sends an address in a header it does not control the meaning
    // of, so identity comes from the connection, not from the request body.
    const who =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";

    if (!limiter.allow(who, now())) {
      return json(429, { error: "That is a lot of uploads at once. Wait a minute and try again." }, origin);
    }

    // Refuse on the declared length before reading anything, so an oversized
    // body is not pulled into memory just to be rejected.
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > limits.maxBytes) {
      return json(413, { error: `That image is too large. The limit is ${Math.floor(limits.maxBytes / 1024 / 1024)} MB.` }, origin);
    }

    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await request.arrayBuffer());
    } catch {
      return json(400, { error: "That upload did not arrive completely. Try again." }, origin);
    }

    // Checked again against the real length. A caller can lie in the header.
    if (bytes.byteLength > limits.maxBytes) {
      return json(413, { error: `That image is too large. The limit is ${Math.floor(limits.maxBytes / 1024 / 1024)} MB.` }, origin);
    }

    if (bytes.byteLength === 0) {
      return json(400, { error: "That file was empty." }, origin);
    }

    const mime = sniffImageType(bytes);
    if (mime === undefined) {
      return json(415, { error: "That file is not an image this server accepts. PNG, JPEG, GIF, and WebP work." }, origin);
    }

    const result = await options.upstream(bytes, mime, env);
    if (!result.ok) {
      // The upstream's reason is deliberately not forwarded. It may name the
      // host, the key, or an internal path, none of which belong in a response.
      return json(502, { error: "The image service would not accept that file. Try again shortly." }, origin);
    }

    return json(200, { url: result.url }, origin);
  };
}
