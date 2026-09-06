import type { Block } from "../../document/types.js";
import type { Target } from "../capabilities.js";
import type { DiagnosticSink } from "../diagnostics.js";
import { escapeText, plainInline } from "../escape.js";
import { encodeAddress, isSafeUrl } from "../link.js";
import { cell, joinParts, safeLink, sectionHeading } from "./shared.js";

type Gallery = Extract<Block, { kind: "gallery" }>;
type Item = Gallery["items"][number];

/**
 * An item paired with the address it will actually be shown at.
 *
 * The address is decided once, by the caller, because it depends on what this
 * host can do. Carrying it alongside the item means the layouts below never ask
 * that question twice and cannot answer it differently.
 */
interface Shown {
  readonly item: Item;
  readonly address: string;
}

/**
 * Emits a gallery.
 *
 * Three layouts. `grid` places images side by side using a table, which needs
 * the table capability and degrades to one per line without it. `list` and
 * `single` both put one image per line and emit identically: Markdown has no
 * width control, so inventing a difference in the output would be pretending to
 * a layout the format cannot express, which is what Principle VII forbids.
 *
 * Image addresses go through the same check as links. An address that is not
 * http or https cannot become an image, because `data:` in an image is a way to
 * put content on the artist's page that neither they nor we chose.
 */
export function emitGallery(block: Gallery, target: Target, sink: DiagnosticSink): string {
  const parts: (string | undefined)[] = [sectionHeading(block.heading, target)];

  const usable: Shown[] = [];

  for (const item of block.items) {
    const local = localId(item);
    const webUsable = isSafeUrl(item.imageUrl);

    // FR-080. A picture held on the device is dropped by a host that cannot
    // show one, and never in silence. Once per item, which is what this
    // emitter's refused address below already does, and a gallery item is one
    // picture in any case.
    if (local !== undefined && !target.capabilities.localImages) {
      sink.add({
        code: "local_image_unsupported",
        severity: "warning",
        blockId: block.id,
        capability: "localImages",
        message: `Your own picture ${itemPhrase(item, block.heading)} is not part of the text you paste into ${target.name}. It appears in the menu file you save.`,
      });
    }

    // A refused address is still refused when something else takes its place,
    // per holistic review HB-6. The one case that stays quiet is an item whose
    // address was never filled in because the picture came from the device:
    // telling that seller their address is not a web address would send them
    // looking for a second problem that does not exist.
    if (!webUsable && (item.imageUrl !== "" || local === undefined)) {
      sink.add({
        code: "link_scheme_refused",
        severity: "warning",
        blockId: block.id,
        message:
          "One of your images does not have an http:// or https:// address, so it has been left out. Images need a web address to show on your page.",
      });
    }

    // The picture from the device wins where the host can show it. A gallery
    // item is one picture, so when it carries both there is a choice to make,
    // and the seller's own photograph is the one the menu file exists for.
    //
    // The superseded address is REPORTED rather than dropped in silence, which
    // is holistic review HB-6 applied to the case it did not anticipate. The
    // comment here used to say "the web address still shows on every paste
    // host, so nothing is lost", and a reviewer pointed out that is false for
    // the seller who only ever sends the menu file. That seller is the one this
    // whole feature is for, so their output is the last place a picture should
    // vanish without a word.
    if (local !== undefined && target.capabilities.localImages) {
      if (webUsable) {
        sink.add({
          code: "picture_superseded",
          severity: "warning",
          blockId: block.id,
          message: `The picture ${itemPhrase(item, block.heading)} has both a photo from your device and a web address. The menu file shows the one from your device. The web address is what appears everywhere you paste this page.`,
        });
      }
      // Encoded like any other address, because a page can arrive from an
      // exported file somebody edited by hand and a bracket in an identifier
      // would otherwise end the image early. CHUNK 1: the app's resolver
      // decodes what it reads back, per contracts/menu-file.md.
      usable.push({ item, address: `mdsb-asset:${local}` });
    } else if (webUsable) {
      usable.push({ item, address: item.imageUrl });
    }
  }

  if (usable.length > 0) {
    parts.push(
      block.layout === "grid" && target.capabilities.tables
        ? imageGrid(usable, block.id, sink)
        : imageRows(usable, block.id, sink),
    );
  }

  return joinParts(parts);
}

/** The picture of an item held on the seller's device. A blank is not a picture. */
function localId(item: Item): string | undefined {
  const id = item.localImageId?.trim() ?? "";
  return id === "" ? undefined : id;
}

/**
 * How to name the item a warning is about, without naming the file.
 *
 * FR-080 says name the picture, FR-081 forbids disclosing the identifier or the
 * original filename, and naming the thing on the page it belongs to is the only
 * way both hold. A caption is what the seller wrote about this picture, so it is
 * the best name there is; the section is the fallback when there is none.
 */
function itemPhrase(item: Item, heading: string | undefined): string {
  const caption = item.caption === undefined ? "" : plainInline(item.caption);
  if (caption !== "") return `on ${caption}`;
  const section = heading === undefined ? "" : plainInline(heading);
  return section === "" ? "in your gallery" : `in ${section}`;
}

/** One image, with its caption as alt text, wrapped in a link when it has one. */
function image({ item, address }: Shown, blockId: string, sink: DiagnosticSink): string {
  const alt = item.caption === undefined ? "" : cell(item.caption);
  const img = `![${alt}](${encodeAddress(address)})`;

  if (item.linkUrl === undefined) return img;

  // safeLink returns a link when the address is safe and plain text when it is
  // not. An unsafe address leaves the image showing but not clickable, which is
  // the right compromise: the artist keeps their picture and loses only the
  // link they should not have had.
  const linked = safeLink("", item.linkUrl, blockId, sink);
  return linked.startsWith("[]") ? `[${img}]${linked.slice(2)}` : img;
}

function imageGrid(items: readonly Shown[], blockId: string, sink: DiagnosticSink): string {
  const columns = 2;
  const rows: string[] = ["| | |", "| --- | --- |"];

  for (let i = 0; i < items.length; i += columns) {
    const pair = items.slice(i, i + columns).map((shown) => image(shown, blockId, sink));
    while (pair.length < columns) pair.push("");
    rows.push(`| ${pair.join(" | ")} |`);
  }

  return rows.join("\n");
}

function imageRows(items: readonly Shown[], blockId: string, sink: DiagnosticSink): string {
  return items
    .map((shown) => {
      const { item } = shown;
      const img = image(shown, blockId, sink);
      if (item.caption === undefined || item.caption === "") return img;
      // The caption is already the alt text. Repeating it below the image is
      // what makes it visible to a sighted reader, since alt text is not shown.
      return `${img}\n\n${escapeText(item.caption)}`;
    })
    .join("\n\n");
}
