/**
 * The deployable entry point, and the one piece of this project that has never
 * run against the real thing.
 *
 * Everything in `upload.ts` is verified by tests. The upstream below is not: it
 * needs an account with an image host and a deployed worker, and neither exists
 * yet. It is written from the host's documented API and marked as unverified,
 * which is the same standard the target records in the engine are held to.
 *
 * To deploy on Cloudflare Workers:
 *
 *   wrangler secret put UPLOAD_KEY
 *   wrangler deploy
 *
 * with `ALLOWED_ORIGINS` and `UPLOAD_ENDPOINT` set as plain variables. The app
 * degrades to address entry when this is absent, so deploying it is optional and
 * turning it off later breaks nothing.
 */
import { createUploadHandler, type Env, type Upstream } from "./upload.js";

/**
 * Forwards to catbox.moe.
 *
 * Chosen because it takes an anonymous or key-authenticated multipart POST and
 * returns the address as plain text, with no JSON envelope to parse and no
 * per-request signing. Written from https://catbox.moe/tools.php.
 *
 * UNVERIFIED against the live service. Nobody has run this. The first person to
 * deploy it should check the response shape before trusting it, and the manual
 * verification checklist in docs/WORKFLOW.md is where that gets recorded.
 */
const catbox: Upstream = async (bytes, mime, env) => {
  const endpoint = env.UPLOAD_ENDPOINT ?? "https://catbox.moe/user/api.php";

  const extension =
    { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" }[mime] ??
    "bin";

  const form = new FormData();
  form.set("reqtype", "fileupload");
  // The key authenticates the upload to the host account. It comes from the
  // environment and exists only inside this function's lifetime.
  if (env.UPLOAD_KEY !== undefined) form.set("userhash", env.UPLOAD_KEY);
  // The underlying buffer rather than the view. A Uint8Array is not a BlobPart
  // under these lib settings, and the slice keeps exactly the bytes we sniffed.
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  form.set("fileToUpload", new Blob([buffer], { type: mime }), `upload.${extension}`);

  try {
    const response = await fetch(endpoint, { method: "POST", body: form });
    const text = (await response.text()).trim();

    if (!response.ok) return { ok: false, reason: `upstream status ${response.status}` };

    // A successful response is the bare address. Anything else is a failure
    // message, and treating it as an address would put junk on someone's page.
    if (!/^https?:\/\/\S+$/i.test(text)) return { ok: false, reason: `unexpected body: ${text.slice(0, 200)}` };

    return { ok: true, url: text };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "network failure" };
  }
};

const handle = createUploadHandler({ upstream: catbox });

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env);
  },
};

export { catbox };
