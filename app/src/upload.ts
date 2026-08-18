/**
 * The client side of uploading an image.
 *
 * Roadmap 3.3. Two jobs: shrink the file before sending it, and degrade cleanly
 * to address entry when there is no proxy to send it to.
 *
 * The degradation is the part that matters. An artist whose upload button does
 * nothing has been failed twice, once by the outage and once by us not saying so.
 * If `VITE_UPLOAD_URL` is not configured, or the proxy does not answer, the
 * upload control is simply not offered and address entry is all there is. The
 * gallery was built to work that way first, in 3.1, precisely so this could be
 * optional.
 */

/**
 * Where the proxy lives, or undefined when this build has no upload support.
 *
 * Read through a narrow declaration rather than by pulling in Vite's whole
 * client type surface, since one string is all that is needed and the engine's
 * zero-dependency discipline is worth extending to types where it is cheap.
 */
const ENDPOINT: string | undefined = (
  import.meta as unknown as { env?: Record<string, string | undefined> }
).env?.["VITE_UPLOAD_URL"];

export function uploadConfigured(): boolean {
  return ENDPOINT !== undefined && ENDPOINT !== "";
}

/**
 * The longest edge we send. 1600 pixels is larger than any of these hosts
 * displays and small enough that a phone photo stops being four megabytes.
 *
 * Shrinking client-side is not a substitute for the server's limit, which is
 * still enforced. It is what stops the artist hitting that limit at all.
 */
const MAX_EDGE = 1600;
const QUALITY = 0.85;

export interface UploadOutcome {
  readonly ok: boolean;
  /** Present on success. */
  readonly url?: string;
  /** Present on failure, written for the artist. */
  readonly message?: string;
}

/**
 * Re-encodes an image through a canvas, capping its longest edge.
 *
 * Named for what it does rather than for what it usually achieves. It normally
 * makes a file much smaller, because most uploads are phone photos. It can also
 * make one LARGER: re-encoding an already well-optimised PNG through a canvas
 * loses whatever compression tuning it had. Measured here at 3.4 kB in, 7.2 kB
 * out on a hand-optimised icon.
 *
 * That trade is accepted deliberately, because the metadata stripping below is
 * worth more than a few kilobytes, and because the server still enforces the
 * real ceiling either way.
 *
 * The reason it always re-encodes, even an image that needs no resizing: a
 * canvas only knows about pixels, so everything else in the file is discarded,
 * including any GPS coordinates a phone camera wrote into it. An artist
 * uploading a photo of their own work should not be publishing their home
 * address alongside it, and almost none of them would think to check.
 *
 * Re-encoding only oversized files would have meant the smallest images, which
 * are the most likely to be straight off a phone, kept their location data.
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

    // PNG for anything with transparency, JPEG otherwise. Guessing wrong on a
    // transparent image produces a black background, which looks like damage.
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
 * Uploads a file and returns its address.
 *
 * Never throws. Every failure is an outcome with a message an artist can act on,
 * for the same reason the validator never throws: a refused upload is an ordinary
 * event, not an exceptional one.
 */
export async function uploadImage(file: File): Promise<UploadOutcome> {
  if (ENDPOINT === undefined || ENDPOINT === "") {
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

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      body,
      headers: { "content-type": body.type },
    });

    if (!response.ok) {
      // The proxy writes messages for artists, so its text is shown as given.
      // Anything unparseable falls back to something honest rather than a code.
      const stated = (await response.json().catch(() => null)) as { error?: string } | null;
      return {
        ok: false,
        message:
          stated?.error ??
          "The upload was refused. You can paste a web address instead, or try again shortly.",
      };
    }

    const result = (await response.json()) as { url?: string };
    if (typeof result.url !== "string") {
      return { ok: false, message: "The upload finished but no address came back. Try again." };
    }
    return { ok: true, url: result.url };
  } catch {
    return {
      ok: false,
      message: "Could not reach the upload service. Check your connection, or paste a web address instead.",
    };
  }
}
