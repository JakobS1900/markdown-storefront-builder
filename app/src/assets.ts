/**
 * Pictures held on the seller's own device.
 *
 * `specs/024-menu-file/data-model.md` section 2 is the authority on the store.
 * This file owns the policy around it: which types may be kept, whether there
 * is room, turning a stored picture into something a render can use, and
 * removing one when the seller says so.
 *
 * THREE RULES SHAPE EVERYTHING HERE, and all three come from the constitution
 * rather than from convenience.
 *
 * 1. Nothing removes a picture except the seller. Not to reclaim space, not to
 *    tidy up an identifier no document mentions any more, not to recover from a
 *    failure. Principle V and research D6. A document pointing at a picture that
 *    is gone is an ordinary state under FR-088, and the price of that rule is
 *    stated rather than hidden: bytes stay on the device until somebody clears
 *    them.
 *
 * 2. The allow list is four raster types and nothing else. `image/svg+xml` is
 *    refused although a browser will not run script in an SVG loaded through
 *    `img`, because the saved menu file leaves this app and is opened by other
 *    people in contexts we do not control. Principle IV says allow list, and
 *    there is no seller need this excludes: `normalise()` re-encodes through a
 *    canvas and would turn an SVG into a raster anyway.
 *
 * 3. A refusal is a sentence somebody can act on. Principle V calls a generic
 *    failure message a defect, and a raw `QuotaExceededError` reaching a seller
 *    is the same defect wearing the browser's clothes.
 *
 * ON THE RESOLVER BEING SYNCHRONOUS. IndexedDB is not, and the menu file is
 * built synchronously so that typing does not stutter and so that the preview
 * and the saved file come from the same call. The two are reconciled by holding
 * what a document needs in memory first: `holdAssets` is asynchronous and
 * gathers, `heldAsset` is synchronous and reads. That is the same shape
 * `fetchPictures` and `buildMenuFile` already have for pictures at web
 * addresses.
 */
import type { Document } from "@mdsb/engine";

import {
  deleteAsset,
  listAssets,
  readAsset,
  writeAsset,
  type StoredAsset,
} from "./db.js";
import { normalise } from "./upload.js";

/**
 * What may be stored. Checked at storage time, not at display time, so a type
 * this app will not show can never get in rather than being filtered out later.
 */
export const ACCEPTED_PICTURE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export interface AddOutcome {
  readonly ok: boolean;
  /** The identifier the document should carry. Present only on success. */
  readonly id?: string;
  /** Written for the seller. Present whenever something was refused. */
  readonly message?: string;
}

/** What one picture costs, for the storage view. Never opens the blob. */
export interface AssetCost {
  readonly id: string;
  readonly bytes: number;
  readonly createdAt: number;
}

/**
 * A size somebody can act on, rather than a byte count.
 *
 * Shared with the export surface deliberately: a seller who is told their
 * pictures cost "4.6 MB" here and that their file is "2.1 MB" there is reading
 * one scale, and two formatters would eventually disagree about which.
 */
export function describeBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * Bytes as base64.
 *
 * `FileReader` would do this in one call and was the first attempt. It reads
 * nothing under jsdom, because the blob a fetch produces there comes from a
 * different realm than the reader, so the embedding test failed with the
 * picture still a web address and no error anywhere. Going through the bytes
 * has no realm to be wrong about.
 *
 * In chunks because `fromCharCode` is applied to the whole array at once and a
 * photograph is a few hundred thousand bytes, which is enough arguments to
 * overflow the call stack.
 */
export function dataUrlFrom(mime: string, bytes: Uint8Array): string {
  let binary = "";
  for (let at = 0; at < bytes.length; at += 8192) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/** The same, for something that arrived as a blob. */
export async function dataUrl(blob: Blob): Promise<string> {
  return dataUrlFrom(blob.type, new Uint8Array(await blob.arrayBuffer()));
}

/**
 * The pictures a synchronous render is allowed to assume it can reach.
 *
 * Read into memory rather than re-read per render: the app rebuilds its whole
 * interface on a repaint, and the preview draws the menu file inside that.
 * Decoding a photograph per keystroke is the cost that made typing expensive on
 * a Moto G7 once already.
 */
const held = new Map<string, string>();

/**
 * Every picture on the device a document points at.
 *
 * Read off the document rather than out of the compiled Markdown, and that is
 * the load bearing half. A seller can type `![x](mdsb-asset:something)` into
 * their own item name, and in the compiled text those characters are
 * indistinguishable from the compiler's own. The document carries the
 * distinction in a field, which is exactly why FR-089 made these identifiers
 * rather than addresses.
 *
 * Blank entries are skipped, matching the three emitters: `menu.ts:172`,
 * `gallery.ts:117` and `profile.ts:44` all treat a blank as no picture.
 */
export function assetIds(doc: Document): string[] {
  const found = new Set<string>();

  const add = (id: string | undefined): void => {
    const trimmed = id?.trim() ?? "";
    if (trimmed !== "") found.add(trimmed);
  };

  for (const block of doc.blocks) {
    if (block.kind === "menu") for (const tier of block.tiers) for (const id of tier.localImageIds ?? []) add(id);
    else if (block.kind === "gallery") for (const item of block.items) add(item.localImageId);
    else if (block.kind === "profile") add(block.localAvatarId);
  }

  return [...found];
}

/** The synchronous resolver the menu file and the editor thumbnail read. */
export function heldAsset(id: string): string | undefined {
  return held.get(id);
}

/**
 * Reads the named pictures into memory. Best effort, always.
 *
 * An identifier with nothing behind it is skipped rather than raised. FR-088
 * makes that an ordinary state, and a page that refused to open because one
 * picture had been cleared would be the failure the requirement exists to stop.
 */
export async function holdAssets(ids: readonly string[]): Promise<void> {
  for (const id of ids) {
    if (held.has(id)) continue;
    try {
      const record = await readAsset(id);
      if (record !== undefined) held.set(id, dataUrlFrom(record.mime, new Uint8Array(record.data)));
    } catch {
      // Storage refused, which is a missing picture rather than a broken page.
    }
  }
}

/**
 * Whether there is room for this many more bytes.
 *
 * Returns the sentence to show the seller, or nothing when it may proceed.
 * FR-084: this runs BEFORE anything is written, so a refusal leaves the store
 * exactly as it was.
 *
 * A browser that will not answer is treated as room. Private browsing and older
 * browsers report nothing at all, and refusing every picture on the strength of
 * a missing number would fail sellers whose device is mostly empty. The write
 * itself still refuses if it cannot fit, and FR-085 makes that survivable.
 */
async function refusalForRoom(bytes: number): Promise<string | undefined> {
  let usage: number | undefined;
  let quota: number | undefined;
  try {
    const estimate = await navigator.storage?.estimate?.();
    usage = estimate?.usage;
    quota = estimate?.quota;
  } catch {
    return undefined;
  }

  if (usage === undefined || quota === undefined) return undefined;
  if (usage + bytes <= quota) return undefined;

  return `Your pictures and pages are already using ${describeBytes(usage)} of the ${describeBytes(quota)} this browser will allow, so there is no room for this one. Remove a picture you no longer need under "Pictures on this device", or free up space on the device itself, then try again. Nothing has been changed.`;
}

/**
 * Stores a picture from the seller's device.
 *
 * Never throws. Every refusal is an outcome carrying a sentence, because being
 * turned down is an ordinary event here and the alternative is always
 * available: paste a web address instead.
 */
export async function addAsset(file: File): Promise<AddOutcome> {
  if (!(ACCEPTED_PICTURE_TYPES as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      message:
        "That kind of file cannot be used as a picture here. PNG, JPEG, GIF and WebP work. Drawings saved as SVG do not, because the file you send has to be safe to open on somebody else's phone.",
    };
  }

  // Before the room check, because the size that matters is the size after
  // re-encoding, and because this is where FR-083 is satisfied: a canvas knows
  // only about pixels, so the location and camera information a phone wrote
  // into the file does not survive. Nothing is written to storage yet.
  let blob: Blob;
  try {
    blob = await normalise(file);
  } catch {
    return { ok: false, message: "That file could not be read as a picture. PNG, JPEG, GIF and WebP work." };
  }

  const data = await blob.arrayBuffer();

  const refusal = await refusalForRoom(data.byteLength);
  if (refusal !== undefined) return { ok: false, message: refusal };

  const asset: StoredAsset = {
    id: crypto.randomUUID(),
    data,
    mime: blob.type,
    bytes: data.byteLength,
    createdAt: Date.now(),
  };

  try {
    await writeAsset(asset);
  } catch {
    // The browser refused after saying there was room, which is the case
    // FR-085 is about. Nothing already stored has been touched.
    return {
      ok: false,
      message:
        "This browser would not keep that picture, and its storage may be full. Nothing you had already saved has been lost. Remove a picture you no longer need under \"Pictures on this device\", then try again.",
    };
  }

  held.set(asset.id, dataUrlFrom(asset.mime, new Uint8Array(data)));
  return { ok: true, id: asset.id };
}

/** What every stored picture costs. Reads the records, never the blobs. */
export async function assetCosts(): Promise<AssetCost[]> {
  return (await listAssets()).map((a) => ({ id: a.id, bytes: a.bytes, createdAt: a.createdAt }));
}

export async function totalAssetBytes(): Promise<number> {
  return (await assetCosts()).reduce((sum, cost) => sum + cost.bytes, 0);
}

/**
 * Removes one picture, because the seller asked.
 *
 * The only caller is the control that says so in as many words. Read rule 1 at
 * the top of this file before adding a second one.
 */
export async function removeAsset(id: string): Promise<void> {
  await deleteAsset(id);
  held.delete(id);
}

/**
 * Asks the browser to treat this storage as permanent. FR-086.
 *
 * Once per session, and a refusal changes nothing: the app carries on exactly
 * as before, because persistence is a browser deciding not to evict us under
 * pressure, not a feature the seller can see. Chrome grants it on a site
 * somebody has engaged with and never asks; Firefox may prompt. Neither
 * outcome is worth reporting.
 */
let askedToKeep = false;

export async function askToKeepStorage(): Promise<void> {
  if (askedToKeep) return;
  askedToKeep = true;
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Some browsers throw rather than answering false. Same outcome.
  }
}
