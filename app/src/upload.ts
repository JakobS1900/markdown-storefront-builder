/**
 * Uploading an image to Imgur, straight from the browser.
 *
 * There is no server. An earlier version routed uploads through a proxy so a
 * key could stay server side, which was the wrong shape for this host: Imgur's
 * anonymous upload uses a Client-ID, and a Client-ID is a public identifier by
 * design. It is meant to be sent from a browser, so hiding it behind a server
 * protected nothing and cost the artist a service that could go down.
 *
 * The tradeoff that IS real, recorded rather than glossed: a public Client-ID
 * can be copied out of the bundle, and someone could spend the daily anonymous
 * quota attached to it. That is a rate limit annoyance, not a credential leak,
 * and the fix is to rotate the ID. Nothing an attacker gets access to belongs
 * to an artist.
 *
 * Set `VITE_IMGUR_CLIENT_ID` at build time. Without it the upload control is
 * not offered at all and pasting an address is the whole feature, which is how
 * the gallery was built in the first place.
 */

const CLIENT_ID: string | undefined = (
  import.meta as unknown as { env?: Record<string, string | undefined> }
).env?.["VITE_IMGUR_CLIENT_ID"];

const ENDPOINT = "https://api.imgur.com/3/image";

export function uploadConfigured(): boolean {
  return CLIENT_ID !== undefined && CLIENT_ID !== "";
}

/**
 * The longest edge we send. 1600 pixels is larger than any of these hosts
 * displays and small enough that a phone photo stops being several megabytes.
 */
const MAX_EDGE = 1600;
const QUALITY = 0.85;

/** Imgur's own ceiling for anonymous uploads. Checked here so the artist gets
 * a sentence they can act on rather than a rejection from someone else's API. */
const MAX_BYTES = 10 * 1024 * 1024;

export interface UploadOutcome {
  readonly ok: boolean;
  readonly url?: string;
  readonly message?: string;
}

/**
 * Re-encodes an image through a canvas, capping its longest edge.
 *
 * Named for what it does rather than what it usually achieves. It normally
 * makes a file much smaller, because most uploads are phone photos. It can also
 * make one larger: re-encoding an already well-optimised PNG through a canvas
 * loses whatever compression tuning it had.
 *
 * It always re-encodes, even an image that needs no resizing, because a canvas
 * only knows about pixels and therefore discards everything else in the file,
 * including any GPS coordinates a phone camera wrote into it. An artist
 * uploading a photo of their own work should not be publishing their home
 * address alongside it, and almost none of them would think to check.
 */
async function normalise(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (context === null) throw new Error("no 2d context");
    context.drawImage(bitmap, 0, 0, width, height);

    // PNG for anything that may carry transparency, JPEG otherwise. Guessing
    // wrong on a transparent image produces a black background, which looks
    // like damage rather than a compression choice.
    const type = file.type === "image/png" || file.type === "image/webp" ? "image/png" : "image/jpeg";

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, type, QUALITY);
    });
    if (blob === null) throw new Error("could not re-encode");
    return blob;
  } finally {
    bitmap.close();
  }
}

/**
 * Uploads to Imgur and returns the address of the image.
 *
 * Never throws. Every failure is an outcome with a message an artist can act
 * on, because a refused upload is an ordinary event rather than an exceptional
 * one, and the alternative is always available: paste an address instead.
 */
export async function uploadImage(file: File): Promise<UploadOutcome> {
  if (CLIENT_ID === undefined || CLIENT_ID === "") {
    return { ok: false, message: "This version cannot upload images. Paste a web address instead." };
  }

  let body: Blob;
  try {
    body = await normalise(file);
  } catch {
    return {
      ok: false,
      message: "That file could not be read as an image. PNG, JPEG, GIF, and WebP work.",
    };
  }

  if (body.size > MAX_BYTES) {
    return { ok: false, message: "That image is too large for Imgur, which accepts up to 10 MB." };
  }

  const form = new FormData();
  form.set("image", body);
  form.set("type", "file");

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Client-ID ${CLIENT_ID}` },
      body: form,
    });

    const payload = (await response.json().catch(() => null)) as
      | { data?: { link?: string; error?: unknown }; success?: boolean }
      | null;

    if (!response.ok || payload?.success !== true) {
      // 429 is the one an artist can actually do something about, so it gets
      // its own sentence rather than a generic failure.
      //
      // It cannot only mean rate limiting, though. Verified against the live
      // API on 2026-08-25: an invalid or revoked Client-ID makes POST /3/image
      // answer 429 "Too Many Requests", byte for byte the same as a genuine
      // limit, while GET /3/credits answers 403 "Invalid client_id". The two
      // cases are indistinguishable here, so the message must not promise that
      // waiting fixes it. An artist whose build has a dead key would otherwise
      // be told to be patient, forever, on every single upload.
      if (response.status === 429) {
        return {
          ok: false,
          message:
            "Imgur would not take that upload just now. Usually that is a busy period and passes within a few minutes. If it keeps happening, this copy of the app may need a new Imgur key. Pasting a web address always works.",
        };
      }
      return {
        ok: false,
        message: "Imgur would not accept that image. You can paste a web address instead, or try again shortly.",
      };
    }

    const link = payload.data?.link;
    if (typeof link !== "string" || link === "") {
      return { ok: false, message: "The upload finished but no address came back. Try again." };
    }

    // Imgur answers with http on some accounts. The page will be served over
    // https, and a mixed-content image is silently blocked by the browser, so
    // the artist would see a working upload and a missing picture.
    return { ok: true, url: link.replace(/^http:\/\//i, "https://") };
  } catch {
    return {
      ok: false,
      message: "Could not reach Imgur. Check your connection, or paste a web address instead.",
    };
  }
}
