import type { Block } from "../../document/types.js";
import type { Target } from "../capabilities.js";
import type { DiagnosticSink } from "../diagnostics.js";
import { escapeText } from "../escape.js";
import { encodeAddress, isSafeUrl } from "../link.js";
import { cell, joinParts, safeLink, sectionHeading } from "./shared.js";

type Gallery = Extract<Block, { kind: "gallery" }>;
type Item = Gallery["items"][number];

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

  const usable = block.items.filter((item) => {
    if (isSafeUrl(item.imageUrl)) return true;
    sink.add({
      code: "link_scheme_refused",
      severity: "warning",
      blockId: block.id,
      message:
        "One of your images does not have an http:// or https:// address, so it has been left out. Images need a web address to show on your page.",
    });
    return false;
  });

  if (usable.length > 0) {
    parts.push(
      block.layout === "grid" && target.capabilities.tables
        ? imageGrid(usable, block.id, sink)
        : imageRows(usable, block.id, sink),
    );
  }

  return joinParts(parts);
}

/** One image, with its caption as alt text, wrapped in a link when it has one. */
function image(item: Item, blockId: string, sink: DiagnosticSink): string {
  const alt = item.caption === undefined ? "" : cell(item.caption);
  const img = `![${alt}](${encodeAddress(item.imageUrl)})`;

  if (item.linkUrl === undefined) return img;

  // safeLink returns a link when the address is safe and plain text when it is
  // not. An unsafe address leaves the image showing but not clickable, which is
  // the right compromise: the artist keeps their picture and loses only the
  // link they should not have had.
  const linked = safeLink("", item.linkUrl, blockId, sink);
  return linked.startsWith("[]") ? `[${img}]${linked.slice(2)}` : img;
}

function imageGrid(items: readonly Item[], blockId: string, sink: DiagnosticSink): string {
  const columns = 2;
  const rows: string[] = ["| | |", "| --- | --- |"];

  for (let i = 0; i < items.length; i += columns) {
    const pair = items.slice(i, i + columns).map((item) => image(item, blockId, sink));
    while (pair.length < columns) pair.push("");
    rows.push(`| ${pair.join(" | ")} |`);
  }

  return rows.join("\n");
}

function imageRows(items: readonly Item[], blockId: string, sink: DiagnosticSink): string {
  return items
    .map((item) => {
      const img = image(item, blockId, sink);
      if (item.caption === undefined || item.caption === "") return img;
      // The caption is already the alt text. Repeating it below the image is
      // what makes it visible to a sighted reader, since alt text is not shown.
      return `${img}\n\n${escapeText(item.caption)}`;
    })
    .join("\n\n");
}
